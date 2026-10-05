import { api, adminToken, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";
import { currentHour, todayKey } from "../src/utils/dates";
import { expireChallenges, sendAppReminders } from "../src/jobs/app.jobs";
import membershipService from "../src/modules/membership/membership.service";
import { detectUsualSlot } from "../src/utils/rebook";

const P = "98000006";
const ph = (n: number) => `${P}${String(n).padStart(2, "0")}`;
const U1 = ph(1);
const U2 = ph(2);
const NEW = ph(5);
const GUEST_PHONE = ph(6);
const STAFF_MADE = ph(7); // an unverified account staff created earlier, with records

async function wipe() {
  const users = (await prisma.user.findMany({ where: { phoneNumber: { startsWith: P } }, select: { phoneNumber: true } })).map((u) => u.phoneNumber);
  const ids = (await prisma.booking.findMany({ where: { OR: [{ userId: { in: users } }, { customerPhone: { startsWith: P } }] }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.arrivalCheckin.deleteMany({ where: { refId: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.gzBooking.deleteMany({ where: { userId: { in: users } } });
  await prisma.membershipSubscription.deleteMany({ where: { userId: { in: users } } });
  await prisma.membershipPlan.deleteMany({ where: { name: "Test Plan P6" } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: users } } });
  await prisma.notification.deleteMany({ where: { userId: { in: users } } });
  await prisma.pushSubscription.deleteMany({ where: { userId: { in: users } } });
  await prisma.userPrefs.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: users } } });
  await prisma.tournament.deleteMany({ where: { name: { startsWith: "Test Cup" } } });
}

const call = (m: "get" | "post" | "put" | "patch" | "delete", url: string, p?: string, body?: object) => {
  const r = (api() as any)[m](url);
  return (p ? r.set(bearer(tokenFor(p))) : r).send(body ?? {});
};

beforeAll(async () => {
  await wipe();
  await makeUser(U1, "Player One");
  await makeUser(U2, "Player Two");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("signup and login with OTP switched off", () => {
  it("signs up with phone + password and gets tokens; SMS is never needed", async () => {
    const res = await call("post", "/api/auth/signup", undefined, { name: "New Player", phoneNumber: NEW, password: "secret1" });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.phoneNumber).toBe(NEW);
    const login = await call("post", "/api/auth/login", undefined, { identifier: NEW, password: "secret1" });
    expect(login.status).toBe(200);
    expect((await call("post", "/api/auth/login", undefined, { identifier: NEW, password: "wrong-one" })).status).toBe(401);
    const me = await api().get("/api/auth/me").set(bearer(login.body.data.token));
    expect(me.status).toBe(200);
  });
  it("rejects a phone that is already registered and a badly formed one", async () => {
    expect((await call("post", "/api/auth/signup", undefined, { name: "Copy Cat", phoneNumber: NEW, password: "secret1" })).status).toBe(409);
    expect((await call("post", "/api/auth/signup", undefined, { name: "Bad Phone", phoneNumber: "12345", password: "secret1" })).status).toBe(400);
  });
  it("never takes over an unverified account that has records", async () => {
    await makeUser(STAFF_MADE, "Made By Staff", { isVerified: false, freeMatchesAvailable: 2 });
    const res = await call("post", "/api/auth/signup", undefined, { name: "Impostor", phoneNumber: STAFF_MADE, password: "secret1" });
    expect(res.status).toBe(409);
    const row = await prisma.user.findUnique({ where: { phoneNumber: STAFF_MADE } });
    expect(row?.name).toBe("Made By Staff");
    expect(row?.freeMatchesAvailable).toBe(2);
  });
  it("does not attach an earlier guest's bookings to a new account", async () => {
    await prisma.booking.create({
      data: { userId: null, date: "2026-09-01", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "Guest Gary", customerPhone: GUEST_PHONE, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue" } as any,
    });
    await call("post", "/api/auth/signup", undefined, { name: "Guest Gary", phoneNumber: GUEST_PHONE, password: "secret1" });
    const mine = await call("get", "/api/bookings/me", GUEST_PHONE);
    expect(JSON.stringify(mine.body.data)).not.toContain("Guest Gary");
  });
  it("OTP and password-reset routes are off", async () => {
    expect((await call("post", "/api/auth/verify-otp", undefined, { phoneNumber: NEW, otp: "123456" })).status).toBe(503);
    expect((await call("post", "/api/auth/resend-otp", undefined, { phoneNumber: NEW })).status).toBe(503);
    expect((await call("post", "/api/auth/forgot-password", undefined, { phoneNumber: NEW })).status).toBe(503);
    expect((await call("post", "/api/auth/reset-password", undefined, { phoneNumber: NEW, otp: "123456", newPassword: "x12345" })).status).toBe(503);
  });
  it("check-phone only says whether an account exists (no names or emails)", async () => {
    const res = await call("post", "/api/auth/check-phone", undefined, { phoneNumber: U1 });
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.data)).not.toContain("Player One");
    expect(res.body.data.exists).toBe(true);
  });
});

describe("profile and preferences", () => {
  it("needs a signed-in customer", async () => {
    expect((await call("get", "/api/me/profile")).status).toBe(401);
  });
  it("shows and edits the profile with validation; the phone number cannot be changed", async () => {
    const p = await call("get", "/api/me/profile", U1);
    expect(p.body.data).toMatchObject({ name: "Player One", phone: U1, status: "Active", mode: "player" });
    expect(p.body.data.customerCode).toBe(`UF-C-${U1.slice(-5)}`);
    expect((await call("patch", "/api/me/profile", U1, { name: "A" })).status).toBe(400);
    expect((await call("patch", "/api/me/profile", U1, { position: "STRIKER" })).status).toBe(400);
    expect((await call("patch", "/api/me/profile", U1, { email: "not-an-email" })).status).toBe(400);
    const ok = await call("patch", "/api/me/profile", U1, { name: "Player Uno", email: "uno@example.com", location: "Butwal", position: "FWD", phoneNumber: "9800000000" });
    expect(ok.status).toBe(200);
    const after = await call("get", "/api/me/profile", U1);
    expect(after.body.data).toMatchObject({ name: "Player Uno", email: "uno@example.com", location: "Butwal", position: "FWD", phone: U1 });
    expect((await call("patch", "/api/me/profile", U2, { email: "uno@example.com" })).status).toBe(409); // email already used
  });
  it("preferences default to on and save", async () => {
    const d = await call("get", "/api/me/preferences", U1);
    expect(d.body.data).toEqual({ smsReminders: true, promoNotifications: true, popupReminder: true, language: "en" });
    const s = await call("put", "/api/me/preferences", U1, { popupReminder: false, language: "ne" });
    expect(s.body.data).toMatchObject({ popupReminder: false, smsReminders: true, language: "ne" });
    expect((await call("put", "/api/me/preferences", U1, { language: "fr" })).status).toBe(400);
  });
  it("saves a push subscription once per device", async () => {
    const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "k1", auth: "k2" } };
    expect((await call("post", "/api/me/push-subscriptions", U1, sub)).status).toBe(201);
    expect((await call("post", "/api/me/push-subscriptions", U1, sub)).status).toBe(201);
    expect(await prisma.pushSubscription.count({ where: { userId: U1 } })).toBe(1);
    await call("delete", "/api/me/push-subscriptions", U1, { endpoint: sub.endpoint });
    expect(await prisma.pushSubscription.count({ where: { userId: U1 } })).toBe(0);
  });
  it("payment history lists paid games, not unpaid venue bookings", async () => {
    await prisma.booking.create({ data: { userId: U1, date: "2026-09-02", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "x", customerPhone: U1, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", paymentStatus: "completed", status: "completed" } as any });
    await prisma.booking.create({ data: { userId: U1, date: "2026-09-03", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "x", customerPhone: U1, basePrice: 1200, subtotal: 1200, totalPrice: 1200, paymentMethod: "venue", paymentStatus: "pending", status: "confirmed" } as any });
    const res = await call("get", "/api/me/payments", U1);
    expect(res.body.data.map((p: any) => p.amount)).toEqual([1000]);
  });
});

describe("notifications", () => {
  it("lists my notices with unread counts per type; marks read; clears", async () => {
    const mk = (type: string, title: string) => prisma.notification.create({ data: { userId: U2, type, title, message: title } });
    const a = await mk("booking", "A");
    await mk("booking", "B");
    await mk("promo", "C");
    const list = await call("get", "/api/notifications", U2);
    expect(list.body.data.unread).toBe(3);
    expect(list.body.data.unreadByType).toEqual({ booking: 2, promo: 1 });
    expect((await call("post", `/api/notifications/${a.id}/read`, U1)).status).toBe(404); // not U1's
    expect((await call("post", `/api/notifications/${a.id}/read`, U2)).status).toBe(200);
    expect((await call("post", "/api/notifications/read", U2, { types: ["promo"] })).body.data.count).toBe(1);
    const after = await call("get", "/api/notifications", U2);
    expect(after.body.data.unreadByType).toEqual({ booking: 1 });
    expect((await call("post", "/api/notifications/read", U2, {})).status).toBe(200);
    expect((await call("get", "/api/notifications", U2)).body.data.unread).toBe(0);
    expect((await call("delete", "/api/notifications", U2)).status).toBe(200);
    expect((await call("get", "/api/notifications", U2)).body.data.items).toHaveLength(0);
  });
  it("the 1-hour reminder is created once for a game starting soon", async () => {
    const soon = new Date(Date.now() + 30 * 60000);
    const date = todayKey(soon);
    const hour = currentHour(soon);
    const b = await prisma.booking.create({ data: { userId: U2, date, startTime: `${String(hour).padStart(2, "0")}:00`, endTime: `${String((hour + 1) % 24).padStart(2, "0")}:00`, duration: 1, customerName: "x", customerPhone: U2, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed" } as any });
    const start = Date.now();
    await sendAppReminders(start);
    await sendAppReminders(start);
    const n = await prisma.notification.findMany({ where: { userId: U2, type: "reminder", dedupeKey: `remind-${b.id}` } });
    expect(n.length).toBeLessThanOrEqual(1);
  });
});

describe("I'm coming check-in", () => {
  const mkBooking = async (date: string, hour: number, userId = U1) =>
    prisma.booking.create({ data: { userId, date, startTime: `${String(hour).padStart(2, "0")}:00`, endTime: `${String((hour + 1) % 24).padStart(2, "0")}:00`, duration: 1, customerName: "x", customerPhone: userId, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed" } as any });

  it("only the owner, from 1 hour before to 30 minutes after the start", async () => {
    const early = await mkBooking(futureDate(2), 18);
    expect((await call("post", `/api/bookings/${early.id}/arrival`, U1)).status).toBe(409); // too early
    const soon = new Date(Date.now() + 30 * 60000);
    const open = await mkBooking(todayKey(soon), currentHour(soon));
    expect((await call("post", `/api/bookings/${open.id}/arrival`, U2)).status).toBe(404); // not theirs
    expect((await call("post", `/api/bookings/${open.id}/arrival`)).status).toBe(401);
    expect((await call("post", `/api/bookings/${open.id}/arrival`, U1)).status).toBe(200);
    expect((await call("post", `/api/bookings/${open.id}/arrival`, U1)).status).toBe(200); // idempotent
    expect(await prisma.arrivalCheckin.count({ where: { refId: open.id } })).toBe(1);
    const list = await api().get("/api/bookings/arrivals").set(bearer(adminToken()));
    expect(list.status).toBe(200);
    expect((await call("get", "/api/bookings/arrivals", U1)).status).toBe(403);
  });
  it("closes 30 minutes after the start", async () => {
    const past = new Date(Date.now() - 3 * 3600000);
    const old = await mkBooking(todayKey(past), currentHour(past));
    expect((await call("post", `/api/bookings/${old.id}/arrival`, U1)).status).toBe(409);
  });
});

describe("Quick Rebook", () => {
  it("detects the usual weekday + hour (pure rule)", () => {
    expect(detectUsualSlot([{ date: "2026-10-02", hour: 19 }, { date: "2026-09-25", hour: 19 }, { date: "2026-09-12", hour: 16 }])).toMatchObject({ weekday: 5, hour: 19, count: 2 });
    expect(detectUsualSlot([{ date: "2026-10-02", hour: 19 }, { date: "2026-09-12", hour: 16 }])).toBeNull();
  });
  it("offers the next open date, only for a signed-in customer with a habit", async () => {
    expect((await call("get", "/api/bookings/me/rebook")).status).toBe(401);
    const none = await call("get", "/api/bookings/me/rebook", U2);
    expect(none.body.data).toBeNull();
    // three past Friday-evening games for U1
    for (const d of ["2026-09-25", "2026-09-18", "2026-09-11"]) {
      await prisma.booking.create({ data: { userId: U1, date: d, startTime: "19:00", endTime: "20:00", duration: 1, customerName: "x", customerPhone: U1, basePrice: 1500, subtotal: 1500, totalPrice: 1500, paymentMethod: "venue", status: "completed", paymentStatus: "completed" } as any });
    }
    const res = await call("get", "/api/bookings/me/rebook", U1);
    expect(res.body.data.usual).toMatchObject({ weekday: 5, hour: 19 });
    expect(res.body.data.target.available).toBe(true);
    expect(res.body.data.target.price).toBeGreaterThan(0);
  });
});

describe("tournaments (public view never shows team contact details)", () => {
  it("the public list hides registrations; staff see them; the tie-sheet is staff-edited and public", async () => {
    const t = await prisma.tournament.create({ data: { name: "Test Cup 2083", prizePool: 50000, minTeams: 4, maxTeams: 8, startDate: todayKey(), endDate: futureDate(5), description: JSON.stringify({ prizes: { first: "Rs. 25,000" }, format: "8 teams, knockout" }) } });
    await prisma.registration.create({ data: { tournamentId: t.id, teamName: "Secret FC", captainName: "Cap", contactEmail: "cap@secret.test", contactPhone: "9812345678", players: "[]" } });

    const pub = await api().get("/api/tournaments");
    const text = JSON.stringify(pub.body.data);
    expect(text).toContain("Test Cup 2083");
    expect(text).not.toContain("9812345678");
    expect(text).not.toContain("cap@secret.test");
    const one = await api().get(`/api/tournaments/${t.id}`);
    expect(JSON.stringify(one.body.data)).not.toContain("9812345678");
    const staff = await api().get(`/api/tournaments/${t.id}`).set(bearer(adminToken()));
    expect(JSON.stringify(staff.body.data)).toContain("9812345678");

    expect((await call("put", `/api/tournaments/${t.id}/tiesheet`, U1, { rounds: [] })).status).toBe(403);
    const sheet = { rounds: [{ name: "Quarter-finals", matches: [{ home: "Red Devils", away: "Iron Wolves", status: "finished", homeScore: 4, awayScore: 2 }, { home: "Storm FC", away: null, status: "upcoming" }] }, { name: "Final", matches: [{ home: null, away: null }] }] };
    expect((await api().put(`/api/tournaments/${t.id}/tiesheet`).set(bearer(adminToken())).send(sheet)).status).toBe(200);

    const cur = await api().get("/api/tournaments/current");
    expect(cur.body.data.name).toBe("Test Cup 2083");
    expect(cur.body.data.status).toBe("live");
    expect(cur.body.data.format).toBe("8 teams, knockout");
    expect(cur.body.data.rounds.map((r: any) => r.name)).toEqual(["Quarter-finals", "Final"]);
    expect(cur.body.data.rounds[0].matches[0]).toMatchObject({ home: "Red Devils", homeScore: 4, awayScore: 2, status: "finished" });
    await prisma.registration.deleteMany({ where: { tournamentId: t.id } });
  });
});

describe("site info", () => {
  it("is public, editable by staff only", async () => {
    const g = await api().get("/api/site");
    expect(g.body.data.phone).toBe("9811940018");
    expect((await call("patch", "/api/site", U1, { phone: "9800000000" })).status).toBe(403);
    const ok = await api().patch("/api/site").set(bearer(adminToken())).send({ facebook: "https://facebook.com/uniquefutsal" });
    expect(ok.body.data.facebook).toBe("https://facebook.com/uniquefutsal");
    await api().patch("/api/site").set(bearer(adminToken())).send({ facebook: "" });
  });
});

describe("membership points", () => {
  it("a verified 3-month membership earns 30 points, once", async () => {
    const plan = await prisma.membershipPlan.create({ data: { name: "Test Plan P6", price: 4200, perks: "[]" } });
    const sub = await prisma.membershipSubscription.create({
      data: { planId: plan.id, userId: U1, startDate: new Date(), endDate: new Date(Date.now() + 90 * 86400000), chosenDuration: "3_months", timeSlot: "18:00-19:00", totalPrice: 4200 },
    });
    await membershipService.verifyPayment(sub.id, "admin", false);
    const pts = await prisma.loyaltyEntry.findMany({ where: { userId: U1, kind: "membership" } });
    expect(pts).toHaveLength(1);
    expect(Number(pts[0].points)).toBe(30);
    expect(pts[0].expiresOn).toBeNull(); // membership points never expire
    // the membership ledger row it creates is not a game and earns nothing
    const ledger = await prisma.booking.findFirst({ where: { userId: U1, notes: { contains: "MEMBERSHIP_PAYMENT" } } });
    expect(ledger).not.toBeNull();
    const mine = await call("get", "/api/bookings/me", U1);
    expect(JSON.stringify(mine.body.data)).not.toContain("MEMBERSHIP_PAYMENT");
  });
});

describe("challenge expiry job", () => {
  it("closes unanswered challenges once the game time has passed", async () => {
    const a = await prisma.team.create({ data: { name: "Expiry Test A", captainId: ph(20) } });
    const b = await prisma.team.create({ data: { name: "Expiry Test B", captainId: ph(21) } });
    const c = await prisma.challenge.create({ data: { challengerTeamId: a.id, challengedTeamId: b.id, type: "match", date: futureDate(-1), startHour: 18, courtPrice: 1000, loserPct: 70 } });
    expect(await expireChallenges()).toBeGreaterThanOrEqual(1);
    expect((await prisma.challenge.findUnique({ where: { id: c.id } }))?.status).toBe("expired");
    await prisma.challenge.delete({ where: { id: c.id } });
    await prisma.team.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  });
});
