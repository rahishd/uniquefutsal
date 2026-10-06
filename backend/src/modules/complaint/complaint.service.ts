import { randomInt } from "crypto";
import { Complaint } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { savePhotos } from "../../utils/complaintMedia";
import notificationService from "../notification/notification.service";

export const COMPLAINT_CATEGORIES = [
  { id: "booking", label: "Booking" },
  { id: "payment", label: "Payment or refund" },
  { id: "facilities", label: "Court or facilities" },
  { id: "staff", label: "Staff behaviour" },
  { id: "gamezone", label: "Gamezone" },
  { id: "membership", label: "Membership" },
  { id: "app", label: "App problem" },
  { id: "other", label: "Other" },
] as const;

export const COMPLAINT_STATUSES = ["open", "in_review", "resolved", "closed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1500;
export const PER_DAY = 5; // anti-spam: complaints one customer can send in 24 hours

// Short code the customer quotes ("CP-7K3QX9"); no 0/O/1/I so it is easy to read out.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "CP-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const labelOf = (id: string) => COMPLAINT_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export function view(c: Complaint) {
  return {
    id: c.id, code: c.code, category: c.category, categoryLabel: labelOf(c.category), message: c.message, bookingCode: c.bookingCode,
    photos: c.photos, status: c.status, staffReply: c.staffReply, createdAt: c.createdAt, resolvedAt: c.resolvedAt,
  };
}

export class ComplaintService {
  async create(userId: string, input: { category?: unknown; message?: unknown; bookingCode?: unknown; photos?: unknown }) {
    const category = typeof input.category === "string" ? input.category : "";
    if (!COMPLAINT_CATEGORIES.some((c) => c.id === category)) throw new AppError(400, "Choose what your complaint is about.");
    const message = typeof input.message === "string" ? input.message.trim() : "";
    if (message.length < MESSAGE_MIN) throw new AppError(400, `Please describe the problem (at least ${MESSAGE_MIN} characters).`);
    if (message.length > MESSAGE_MAX) throw new AppError(400, `Please keep it under ${MESSAGE_MAX} characters.`);

    let bookingCode: string | null = null;
    if (typeof input.bookingCode === "string" && input.bookingCode.trim()) {
      const code = input.bookingCode.trim().toUpperCase().slice(0, 20);
      // only a booking on this customer's own account can be referenced
      const own = await prisma.booking.findFirst({ where: { code, OR: [{ userId }, { customerPhone: userId }] }, select: { id: true } });
      const ownGz = own ? null : await prisma.gzBooking.findFirst({ where: { code, userId }, select: { id: true } });
      if (!own && !ownGz) throw new AppError(400, "That booking code is not on your account. Check it, or leave it empty.");
      bookingCode = code;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.complaint.count({ where: { userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can send up to ${PER_DAY} complaints a day. Please try again tomorrow, or call the venue.`);
    }

    // a unique code first, then the photos (named after it), then the row
    let code = makeCode();
    for (let i = 0; i < 5 && (await prisma.complaint.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
    const photos = await savePhotos(code, input.photos);
    const row = await prisma.complaint.create({ data: { code, userId, category, message, bookingCode, photos } });
    return view(row);
  }

  async mine(userId: string) {
    const rows = await prisma.complaint.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map(view);
  }

  /* ---------- staff ---------- */

  async adminList(status?: string, page = 1, limit = 25) {
    const where = status && (COMPLAINT_STATUSES as readonly string[]).includes(status) ? { status } : {};
    const [rows, total] = await Promise.all([
      prisma.complaint.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: (page - 1) * limit }),
      prisma.complaint.count({ where }),
    ]);
    const users = await prisma.user.findMany({ where: { phoneNumber: { in: [...new Set(rows.map((r) => r.userId))] } }, select: { phoneNumber: true, name: true } });
    const name = new Map(users.map((u) => [u.phoneNumber, u.name]));
    return { items: rows.map((r) => ({ ...view(r), userId: r.userId, customerName: name.get(r.userId) ?? null })), total, page, limit };
  }

  // Staff set the status and/or write a reply; the customer is notified in the app.
  async adminUpdate(staffId: string, id: string, input: { status?: string; reply?: string }) {
    const c = await prisma.complaint.findUnique({ where: { id } });
    if (!c) throw new AppError(404, "Complaint not found");
    if (input.status !== undefined && !(COMPLAINT_STATUSES as readonly string[]).includes(input.status)) throw new AppError(400, "Unknown status");
    const reply = input.reply?.trim();
    if (reply !== undefined && reply.length > 1000) throw new AppError(400, "Keep the reply under 1000 characters.");
    const status = (input.status ?? c.status) as ComplaintStatus;
    const done = status === "resolved" || status === "closed";
    const upd = await prisma.complaint.update({
      where: { id },
      data: { status, ...(reply ? { staffReply: reply, repliedBy: staffId } : {}), resolvedAt: done ? c.resolvedAt ?? new Date() : null },
    });
    const changed = status !== c.status || (!!reply && reply !== c.staffReply);
    if (changed) {
      const text = reply ? `The venue replied: ${reply.slice(0, 120)}${reply.length > 120 ? "…" : ""}` : `Status: ${status.replace("_", " ")}.`;
      await notificationService.notify({ userId: c.userId, type: "complaint", title: `Update on your complaint ${c.code}`, message: text, href: "/complaints" });
    }
    return view(upd);
  }
}

export default new ComplaintService();
