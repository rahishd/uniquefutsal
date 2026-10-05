import { api, bearer, futureDate, makeUser, prisma, tokenFor, adminToken } from "./helpers";
import { setGoogleVerifier } from "../src/modules/auth/google.routes";
import paymentService from "../src/modules/payment/payment.service";
import { HashUtil } from "../src/utils/hash";

const A = "9800000401";
const B = "9800000402";
const PLAYER = "9800000403";

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { OR: [{ userId: { in: [A, B, PLAYER] } }, { customerPhone: { in: [A, B, PLAYER] } }] }, select: { id: true } })).map((b) => b.id);
  await prisma.playerGameStat.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B, PLAYER] } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B, PLAYER] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Alpha");
  await makeUser(B, "Beta");
  await makeUser(PLAYER, "Player Three");
});
afterAll(async () => {
  setGoogleVerifier(null);
  await wipe();
  await prisma.$disconnect();
});

const post = (url: string, body: object, token?: string) => {
  const r = api().post(url);
  return (token ? r.set(bearer(token)) : r).send(body);
};

describe("short booking code", () => {
  it("is returned on create and unique", async () => {
    const r = await post("/api/bookings/checkout", { date: futureDate(3), startTime: "18:00", method: "venue" }, tokenFor(A));
    expect(r.status).toBe(201);
    const row = await prisma.booking.findFirst({ where: { userId: A } });
    expect(row?.code).toMatch(/^UF-[2-9A-HJ-NP-Z]{6}$/);
    expect(JSON.stringify(r.body)).toContain(row!.code!);
  });
});

describe("free cancellation", () => {
  it("cancels for free, frees the slot and marks a paid online order refunded", async () => {
    const r = await post("/api/bookings/checkout", { date: futureDate(4), startTime: "19:00", method: "esewa" }, tokenFor(A));
    expect(r.status).toBe(201);
    const b = await prisma.booking.findFirst({ where: { userId: A, date: futureDate(4) } });
    await paymentService.markPaid(b!.id, { source: "test" });
    const c = await post(`/api/bookings/${b!.id}/cancel`, {}, tokenFor(A));
    expect(c.status).toBe(200);
    expect(c.body.data.refundDue).toBe(b!.totalPrice);
    expect((await prisma.paymentOrder.findUnique({ where: { orderCode: b!.id } }))?.status).toBe("refunded");
    expect(await prisma.bookingSlot.count({ where: { bookingId: b!.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: A, dedupeKey: `cancel-${b!.id}` } })).toBe(1);
    // the slot can be booked again
    expect((await post("/api/bookings/checkout", { date: futureDate(4), startTime: "19:00", method: "venue" }, tokenFor(B))).status).toBe(201);
  });
  it("only the owner can cancel", async () => {
    const b = await prisma.booking.findFirst({ where: { userId: B, date: futureDate(4) } });
    expect((await post(`/api/bookings/${b!.id}/cancel`, {}, tokenFor(A))).status).toBe(403);
  });
});

describe("goals and assists", () => {
  let bookingId = "";
  beforeAll(async () => {
    const b = await prisma.booking.create({ data: { userId: PLAYER, date: futureDate(-2), startTime: "17:00", endTime: "18:00", duration: 1, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "completed", paymentStatus: "completed" } });
    bookingId = b.id;
  });
  it("staff only; players cannot record their own", async () => {
    const body = { stats: [{ phone: PLAYER, goals: 2, assists: 1 }] };
    expect((await api().put(`/api/bookings/${bookingId}/player-stats`).set(bearer(tokenFor(PLAYER))).send(body)).status).toBe(403);
    expect((await api().put(`/api/bookings/${bookingId}/player-stats`).send(body)).status).toBe(401);
  });
  it("records numbers, validates them and shows them in gameplay", async () => {
    const put = (stats: object[]) => api().put(`/api/bookings/${bookingId}/player-stats`).set(bearer(adminToken())).send({ stats });
    expect((await put([{ phone: "9899999999", goals: 1, assists: 0 }])).status).toBe(404);
    expect((await put([{ phone: PLAYER, goals: -1, assists: 0 }])).status).toBe(400);
    expect((await put([{ phone: PLAYER, goals: 2, assists: 1 }, { phone: A, goals: 1, assists: 0 }])).status).toBe(200);
    const g = await api().get("/api/me/gameplay").set(bearer(tokenFor(PLAYER)));
    expect(g.body.data.totals).toMatchObject({ games: 1, goals: 2, assists: 1, withStats: 1 });
    const mine = await api().get("/api/me/gameplay").set(bearer(tokenFor(A)));
    expect(mine.body.data.games.some((x: { id: string; goals: number }) => x.id === bookingId && x.goals === 1)).toBe(true); // a teammate game shows up too
  });
  it("replaces numbers when staff correct them", async () => {
    await api().put(`/api/bookings/${bookingId}/player-stats`).set(bearer(adminToken())).send({ stats: [{ phone: PLAYER, goals: 5, assists: 0 }] }).expect(200);
    expect((await api().get("/api/me/gameplay").set(bearer(tokenFor(PLAYER)))).body.data.totals.goals).toBe(5);
  });
  it("a game that has not started cannot get stats", async () => {
    const f = await prisma.booking.create({ data: { userId: PLAYER, date: futureDate(5), startTime: "17:00", endTime: "18:00", duration: 1, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed" } });
    expect((await api().put(`/api/bookings/${f.id}/player-stats`).set(bearer(adminToken())).send({ stats: [{ phone: PLAYER, goals: 1, assists: 0 }] })).status).toBe(409);
  });
});

describe("password reset with Google", () => {
  const verify = (sub: string, email = "p@example.com", emailVerified = true) =>
    setGoogleVerifier(async (t) => {
      if (t === "bad") throw new Error("bad token");
      return { sub, email, emailVerified };
    });
  it("links a Google account while signed in", async () => {
    verify("g-A");
    expect((await post("/api/auth/google/link", { idToken: "ok" }, tokenFor(A))).status).toBe(200);
    const s = await api().get("/api/auth/google/status").set(bearer(tokenFor(A)));
    expect(s.body.data).toMatchObject({ linked: true, email: "p@example.com", configured: true });
  });
  it("refuses the same Google account on a second player", async () => {
    verify("g-A");
    expect((await post("/api/auth/google/link", { idToken: "ok" }, tokenFor(B))).status).toBe(409);
  });
  it("resets the password only for the matching Google account", async () => {
    const reset = (phone: string, idToken: string, pw = "NewPass#99") => post("/api/auth/reset-password/google", { phoneNumber: phone, idToken, newPassword: pw });
    verify("g-other");
    expect((await reset(A, "ok")).status).toBe(403); // someone else's Google account
    expect((await reset(B, "ok")).status).toBe(403); // number without a link
    verify("g-A", "p@example.com", false);
    expect((await reset(A, "ok")).status).toBe(401); // email not verified
    verify("g-A");
    expect((await reset(A, "bad")).status).toBe(401);
    expect((await reset(A, "ok", "123")).status).toBe(400);
    expect((await reset(A, "ok")).status).toBe(200);
    const u = await prisma.user.findUnique({ where: { phoneNumber: A } });
    expect(await HashUtil.compare("NewPass#99", u!.password)).toBe(true);
    expect((await post("/api/auth/login", { identifier: A, password: "NewPass#99" })).status).toBe(200);
  });
  it("unlinking removes the ability to reset", async () => {
    verify("g-A");
    expect((await post("/api/auth/google/unlink", {}, tokenFor(A))).status).toBe(200);
    expect((await post("/api/auth/reset-password/google", { phoneNumber: A, idToken: "ok", newPassword: "Another#11" })).status).toBe(403);
  });
});
