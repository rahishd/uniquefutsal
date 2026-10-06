import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import paymentService, { QR_HOLD_MS } from "../payment/payment.service";
import notificationService from "../notification/notification.service";
import { addDaysKey, currentHour, startsAtMs, todayKey } from "../../utils/dates";

// Gamezone (PS5) rules for the customer app. Values here are the defaults the owner gave; the consoles, games
// and per-person rates live in the database and staff can change them.
export const GZ_OPEN_HOUR = 10;
export const GZ_CLOSE_HOUR = 22; // sessions must end by 10 PM
export const GZ_MAX_HOURS = 4;
export const GZ_MAX_ADVANCE_DAYS = 10;
const PHONE = /^9\d{9}$/;

const DEFAULT_CONSOLES = ["PS5 Station 1", "PS5 Station 2"];
const DEFAULT_GAMES = ["GTA 5", "Forza Horizon", "Red Dead Redemption", "FIFA 26"];
const DEFAULT_PLANS = [
  { players: 1, label: "Solo", ratePerPersonHour: 300 },
  { players: 2, label: "2 Players", ratePerPersonHour: 200 },
  { players: 4, label: "4 Players", ratePerPersonHour: 150 },
];

export const gzTotal = (rate: number, players: number, hours: number) => rate * players * hours;

export interface GzCheckoutInput {
  date: string;
  hour: number;
  hours: number;
  players: number;
  consoleId: string;
  gameTitle: string;
  method: "fonepay" | "venue";
  guest?: { name?: string; phone?: string };
}

export class GamezoneCustomerService {
  // First use fills in the owner's defaults; after that staff own the data.
  async ensureDefaults() {
    if ((await prisma.gzConsole.count()) === 0) await prisma.gzConsole.createMany({ data: DEFAULT_CONSOLES.map((name) => ({ name })), skipDuplicates: true });
    if ((await prisma.gzGame.count()) === 0) await prisma.gzGame.createMany({ data: DEFAULT_GAMES.map((title) => ({ title })), skipDuplicates: true });
    if ((await prisma.gzPlan.count()) === 0) await prisma.gzPlan.createMany({ data: DEFAULT_PLANS, skipDuplicates: true });
  }

  async catalog() {
    await this.ensureDefaults();
    const [consoles, games, plans] = await Promise.all([
      prisma.gzConsole.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.gzGame.findMany({ where: { active: true }, orderBy: { title: "asc" } }),
      prisma.gzPlan.findMany({ orderBy: { players: "asc" } }),
    ]);
    return {
      consoles: consoles.map((c) => ({ id: c.id, name: c.name })),
      games: games.map((g) => ({ id: g.id, title: g.title })),
      plans: plans.map((p) => ({ players: p.players, label: p.label, ratePerPersonHour: p.ratePerPersonHour })),
      maxHours: GZ_MAX_HOURS,
      openHour: GZ_OPEN_HOUR,
      closeHour: GZ_CLOSE_HOUR,
    };
  }

  private assertDate(date: string) {
    const today = todayKey();
    if (date < today) throw new AppError(400, "Cannot book a session in the past");
    if (date > addDaysKey(today, GZ_MAX_ADVANCE_DAYS)) throw new AppError(400, `Bookings open only ${GZ_MAX_ADVANCE_DAYS} days in advance.`);
  }

  // Start hours where THIS console is free for every hour of the session (each console has its own bookings).
  async slots(date: string, hours: number, consoleId: string): Promise<number[]> {
    this.assertDate(date);
    if (!Number.isInteger(hours) || hours < 1 || hours > GZ_MAX_HOURS) throw new AppError(400, `Hours must be 1 to ${GZ_MAX_HOURS}`);
    const consoleRow = await prisma.gzConsole.findFirst({ where: { id: consoleId, active: true } });
    if (!consoleRow) throw new AppError(404, "Console not found");
    const busy = new Set((await prisma.gzSlot.findMany({ where: { consoleId, date }, select: { hour: true } })).map((s) => s.hour));
    const nowHour = currentHour();
    const out: number[] = [];
    for (let h = GZ_OPEN_HOUR; h + hours <= GZ_CLOSE_HOUR; h++) {
      if (date === todayKey() && h <= nowHour) continue;
      let free = true;
      for (let k = h; k < h + hours; k++) if (busy.has(k)) free = false;
      if (free) out.push(h);
    }
    return out;
  }

  private genCode(date: string) {
    return `UF-GZ-${date.replace(/-/g, "")}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
  }

  async checkout(input: GzCheckoutInput, userId?: string) {
    await this.ensureDefaults();
    this.assertDate(input.date);
    if (!Number.isInteger(input.hours) || input.hours < 1 || input.hours > GZ_MAX_HOURS) throw new AppError(400, `Hours must be 1 to ${GZ_MAX_HOURS}`);
    if (!Number.isInteger(input.hour) || input.hour < GZ_OPEN_HOUR || input.hour + input.hours > GZ_CLOSE_HOUR) throw new AppError(400, "That time is outside opening hours");
    if (input.date === todayKey() && input.hour <= currentHour()) throw new AppError(400, "Cannot book a session that has already started");

    const plan = await prisma.gzPlan.findUnique({ where: { players: input.players } });
    if (!plan) throw new AppError(400, "Choose 1, 2 or 4 players");
    const consoleRow = await prisma.gzConsole.findFirst({ where: { id: input.consoleId, active: true } });
    if (!consoleRow) throw new AppError(404, "Console not found");
    const game = await prisma.gzGame.findFirst({ where: { title: input.gameTitle, active: true } });
    if (!game) throw new AppError(400, "Choose a game from the list");

    // Guest rules: details and full online payment. Registered customers: identity comes from the account.
    let guestName: string | null = null;
    let guestPhone: string | null = null;
    if (!userId) {
      const name = (input.guest?.name ?? "").trim();
      const phone = (input.guest?.phone ?? "").trim();
      if (name.length < 2) throw new AppError(400, "Enter your full name");
      if (!PHONE.test(phone)) throw new AppError(400, "Enter a 10-digit mobile number starting with 9");
      if (input.method === "venue") throw new AppError(403, "Guests must pay in full online with Fonepay.");
      guestName = name;
      guestPhone = phone;
    } else if (input.guest) {
      throw new AppError(400, "Signed-in customers do not send guest details");
    }

    const total = gzTotal(plan.ratePerPersonHour, input.players, input.hours); // the server sets the price
    const code = this.genCode(input.date);
    const online = input.method !== "venue";

    try {
      await prisma.$transaction(async (tx) => {
        await tx.gzBooking.create({
          data: {
            code,
            userId: userId ?? null,
            guestName,
            guestPhone,
            consoleId: consoleRow.id,
            gameTitle: game.title,
            date: input.date,
            startHour: input.hour,
            hours: input.hours,
            players: input.players,
            total,
            paymentMethod: input.method,
            paymentStatus: online ? "pending" : "pay_at_venue",
            holdExpiresAt: online ? new Date(Date.now() + QR_HOLD_MS) : null,
          },
        });
        // the unique (console, date, hour) index decides who gets the hours if two requests race
        await tx.gzSlot.createMany({ data: Array.from({ length: input.hours }, (_, i) => ({ consoleId: consoleRow.id, date: input.date, hour: input.hour + i, bookingCode: code })) });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "That console is already booked for part of this time. Please choose another time.");
      }
      throw e;
    }

    let payment = null;
    if (online) {
      try {
        payment = await paymentService.createOrder({ orderCode: code, purpose: "gamezone", userId: userId ?? null, guestPhone, method: input.method as "fonepay", amount: total });
      } catch (err) {
        await this.release(code, "cancelled");
        throw err;
      }
    }

    if (userId) {
      await notificationService.notify({
        userId,
        type: "gamezone",
        title: "Gamezone booked",
        message: `PS5 · ${game.title} · ${input.date} ${String(input.hour).padStart(2, "0")}:00 for ${input.hours} hr. ID ${code}.`,
        href: "/gamezone",
        dedupeKey: `gz-created-${code}`,
      });
    }

    const booking = await prisma.gzBooking.findUnique({ where: { code } });
    return { booking: this.view(booking!, consoleRow.name), payment };
  }

  view(b: { code: string; consoleId: string; gameTitle: string; date: string; startHour: number; hours: number; players: number; total: number; paymentMethod: string; paymentStatus: string; status: string }, consoleName?: string) {
    return {
      code: b.code, console: consoleName ?? b.consoleId, consoleId: b.consoleId, game: b.gameTitle, date: b.date, startHour: b.startHour, hours: b.hours,
      players: b.players, total: b.total, paymentMethod: b.paymentMethod, paymentStatus: b.paymentStatus, status: b.status,
    };
  }

  async release(code: string, status: "cancelled" | "expired") {
    await prisma.gzSlot.deleteMany({ where: { bookingCode: code } });
    await prisma.gzBooking.updateMany({ where: { code }, data: { status } });
  }

  async mine(userId: string) {
    const consoles = new Map((await prisma.gzConsole.findMany()).map((c) => [c.id, c.name]));
    const rows = await prisma.gzBooking.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { startHour: "desc" }], take: 200 });
    return rows.map((b) => this.view(b, consoles.get(b.consoleId)));
  }

  // The owner of a session may cancel it before it starts. The record is kept.
  async cancel(code: string, userId: string) {
    const b = await prisma.gzBooking.findUnique({ where: { code } });
    if (!b || b.userId !== userId) throw new AppError(404, "Booking not found");
    if (b.status !== "confirmed") throw new AppError(400, "This booking cannot be cancelled");
    if (startsAtMs(b.date, b.startHour) <= Date.now()) throw new AppError(400, "Cannot cancel a session that has already started");
    await this.release(code, "cancelled");
    const refund = await paymentService.refundOnCancel(code);
    return { code, status: "cancelled", refundDue: refund };
  }

  // Staff collected the money at the venue.
  async markPaid(code: string) {
    const b = await prisma.gzBooking.findUnique({ where: { code } });
    if (!b) throw new AppError(404, "Booking not found");
    if (b.status !== "confirmed") throw new AppError(409, `Booking is ${b.status}`);
    await prisma.gzBooking.update({ where: { code }, data: { paymentStatus: "paid", holdExpiresAt: null } });
    await prisma.paymentOrder.updateMany({ where: { orderCode: code, status: "pending" }, data: { status: "paid", paidAt: new Date(), paidBy: "staff" } });
    return { code, paymentStatus: "paid" };
  }
}

export const gamezoneCustomerService = new GamezoneCustomerService();
export default gamezoneCustomerService;
