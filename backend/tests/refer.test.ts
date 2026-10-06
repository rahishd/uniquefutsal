import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { addDaysKey, todayKey } from "../src/utils/dates";

const A = "9800000901"; // books for another team
const B = "9800000902"; // captain of the other team
const C = "9800000903";
const ghost = "9800000999"; // not registered
let n = 0;

const mkBooking = (userId: string, over: Record<string, unknown> = {}) =>
  prisma.booking.create({ data: { userId, date: addDaysKey(todayKey(), 1), startTime: "18:00", endTime: "19:00", duration: 1, customerName: "x", basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed", code: `UF-RF${String(++n).padStart(4, "0")}`, ...over } });
const send = (phone: string, body: object) => api().post("/api/refer").set(bearer(tokenFor(phone))).send(body);
async function wipe() {
  await prisma.referral.deleteMany({ where: { referrerId: { in: [A, B, C] } } });
  await prisma.booking.deleteMany({ where: { userId: { in: [A, B, C] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B, C] } } });
  await prisma.settings.deleteMany({ where: { key: "referEarn" } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B, C] } } });
}
beforeAll(async () => { await wipe(); await makeUser(A, "Referrer A"); await makeUser(B, "Captain B"); await makeUser(C, "Other C"); });
afterAll(wipe);

describe("refer and earn", () => {
  it("shows the rules without signing in, and needs sign-in for the rest", async () => {
    const r = await api().get("/api/refer/rules");
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ enabled: true, referrerPoints: 10, friendPoints: 10, perDay: 5 });
    expect((await api().get("/api/refer/me")).status).toBe(401);
    expect((await api().post("/api/refer").send({})).status).toBe(401);
  });

  it("files a referral for a booking on the account, tells the friend, and lists it for both", async () => {
    const b = await mkBooking(A);
    const eligible = await api().get("/api/refer/me").set(bearer(tokenFor(A)));
    expect(eligible.body.data.eligibleBookings.map((x: { code: string }) => x.code)).toContain(b.code);
    const r = await send(A, { bookingCode: b.code!.toLowerCase(), friendPhone: B, teamName: "Thunder FC" });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: "pending", role: "referrer", points: 10, teamName: "Thunder FC" });
    expect(r.body.data.code).toMatch(/^RF-[A-Z2-9]{6}$/);
    const mineA = await api().get("/api/refer/me").set(bearer(tokenFor(A)));
    expect(mineA.body.data.referrals).toHaveLength(1);
    expect(mineA.body.data.eligibleBookings.map((x: { code: string }) => x.code)).not.toContain(b.code);
    const mineB = await api().get("/api/refer/me").set(bearer(tokenFor(B)));
    expect(mineB.body.data.referrals[0]).toMatchObject({ role: "friend", points: 10, referrerName: "Referrer A" });
    expect(await prisma.notification.count({ where: { userId: B, type: "referral" } })).toBe(1);
    expect((await api().get("/api/refer/me").set(bearer(tokenFor(C)))).body.data.referrals).toHaveLength(0);
  });

  it("refuses the same booking twice, someone else's booking, cancelled bookings, yourself and unregistered friends", async () => {
    const b = await mkBooking(A);
    expect((await send(A, { bookingCode: b.code, friendPhone: B, teamName: "Thunder FC" })).status).toBe(201);
    expect((await send(A, { bookingCode: b.code, friendPhone: C, teamName: "Other" })).status).toBe(409);
    const theirs = await mkBooking(C);
    expect((await send(A, { bookingCode: theirs.code, friendPhone: B, teamName: "Thunder FC" })).status).toBe(404);
    const gone = await mkBooking(A, { status: "cancelled" });
    expect((await send(A, { bookingCode: gone.code, friendPhone: B, teamName: "Thunder FC" })).status).toBe(409);
    const old = await mkBooking(A, { date: addDaysKey(todayKey(), -60) });
    expect((await send(A, { bookingCode: old.code, friendPhone: B, teamName: "Thunder FC" })).status).toBe(409);
    const fresh = await mkBooking(A);
    expect((await send(A, { bookingCode: fresh.code, friendPhone: A, teamName: "Me FC" })).status).toBe(400);
    expect((await send(A, { bookingCode: fresh.code, friendPhone: ghost, teamName: "Ghosts" })).status).toBe(404);
    for (const bad of [{ friendPhone: "123" }, { teamName: "x" }, { bookingCode: "" }]) {
      expect((await send(A, { bookingCode: fresh.code, friendPhone: B, teamName: "Thunder FC", ...bad })).status).toBe(400);
    }
  });

  it("uses the points set by staff, can be paused, and a pending referral can be withdrawn", async () => {
    await prisma.settings.create({ data: { key: "referEarn", value: JSON.stringify({ enabled: true, referrerPoints: 15, friendPoints: 5 }) } });
    const b = await mkBooking(A);
    const r = await send(A, { bookingCode: b.code, friendPhone: B, teamName: "Thunder FC" });
    expect(r.body.data.points).toBe(15);
    expect((await api().get("/api/refer/me").set(bearer(tokenFor(B)))).body.data.referrals.find((x: { id: string }) => x.id === r.body.data.id).points).toBe(5);
    expect((await api().delete(`/api/refer/${r.body.data.id}`).set(bearer(tokenFor(B)))).status).toBe(404);
    expect((await api().delete(`/api/refer/${r.body.data.id}`).set(bearer(tokenFor(A)))).status).toBe(200);
    await prisma.settings.update({ where: { key: "referEarn" }, data: { value: JSON.stringify({ enabled: false, referrerPoints: 15, friendPoints: 5 }) } });
    expect((await send(A, { bookingCode: b.code, friendPhone: B, teamName: "Thunder FC" })).status).toBe(403);
  });

  it("an approved referral cannot be withdrawn, and referrals per day are limited", async () => {
    await prisma.settings.deleteMany({ where: { key: "referEarn" } });
    await prisma.referral.deleteMany({ where: { referrerId: A } });
    const first = await mkBooking(A);
    const r = await send(A, { bookingCode: first.code, friendPhone: B, teamName: "Thunder FC" });
    await prisma.referral.update({ where: { id: r.body.data.id }, data: { status: "approved" } });
    expect((await api().delete(`/api/refer/${r.body.data.id}`).set(bearer(tokenFor(A)))).status).toBe(409);
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await send(A, { bookingCode: (await mkBooking(A)).code, friendPhone: B, teamName: "Thunder FC" })).status);
    expect(codes).toEqual([201, 201, 201, 201, 429]);
  });
});

describe("book a slot and refer in one step", () => {
  const slotDate = addDaysKey(todayKey(), 3);
  const book = (phone: string, body: object) => api().post("/api/refer/book").set(bearer(tokenFor(phone))).send(body);
  const cleanSlots = async () => {
    const ids = (await prisma.booking.findMany({ where: { userId: A, date: slotDate }, select: { id: true } })).map((b) => b.id);
    await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.referral.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  };
  const resetLimit = () => prisma.referral.deleteMany({ where: { referrerId: { in: [A, C] } } });
  beforeAll(async () => { await resetLimit(); await cleanSlots(); });
  afterAll(cleanSlots);

  it("needs sign-in", async () => {
    expect((await api().post("/api/refer/book").send({})).status).toBe(401);
  });

  it("reserves the slot on the customer's account (pay at venue) and files the referral", async () => {
    const r = await book(A, { date: slotDate, startTime: "06:00", friendPhone: B, friendName: "Thunder FC" });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: "pending", role: "referrer", teamName: "Thunder FC" });
    const b = await prisma.booking.findFirst({ where: { userId: A, date: slotDate, startTime: "06:00" } });
    expect(b).toMatchObject({ paymentMethod: "venue", status: "pending" });
    expect(r.body.data.bookingCode).toBe(b!.code);
  });

  it("the same slot cannot be taken twice", async () => {
    expect((await book(C, { date: slotDate, startTime: "06:00", friendPhone: B, friendName: "Other FC" })).status).toBeGreaterThanOrEqual(400);
  });

  it("a bad friend number leaves no booking behind and frees the slot", async () => {
    const r = await book(A, { date: slotDate, startTime: "07:00", friendPhone: ghost, friendName: "Ghost FC" });
    expect(r.status).toBe(404);
    expect((await prisma.booking.findFirst({ where: { userId: A, date: slotDate, startTime: "07:00", status: { not: "cancelled" } } }))).toBeNull();
    expect((await book(C, { date: slotDate, startTime: "07:00", friendPhone: B, friendName: "Real FC" })).status).toBe(201);
    const ids = (await prisma.booking.findMany({ where: { userId: C, date: slotDate }, select: { id: true } })).map((b) => b.id);
    await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.referral.deleteMany({ where: { bookingId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  });

  it("refuses a date outside the booking window and a missing time", async () => {
    expect((await book(A, { date: addDaysKey(todayKey(), 11), startTime: "06:00", friendPhone: B, friendName: "X Team" })).status).toBe(400);
    expect((await book(A, { date: slotDate, friendPhone: B, friendName: "X Team" })).status).toBe(400);
  });
});
