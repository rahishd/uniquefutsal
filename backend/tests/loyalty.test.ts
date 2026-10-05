import { api, adminToken, bearer, makeUser, prisma, tokenFor } from "./helpers";
import loyaltyService from "../src/modules/loyalty/loyalty.service";

const U = "9800000201";
const G = "9800000202";

async function wipe() {
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: [U, G] } } });
  await prisma.freeGameVoucher.deleteMany({ where: { userId: { in: [U, G] } } });
  await prisma.goodsSale.deleteMany({ where: { phone: { in: [U, G] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [U, G] } } });
  await prisma.booking.deleteMany({ where: { OR: [{ userId: U }, { customerPhone: { in: [U, G] } }] } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [U, G] } } });
}

const booking = (over: Record<string, unknown> = {}) =>
  prisma.booking.create({
    data: {
      userId: U, date: "2026-09-01", startTime: "19:00", endTime: "20:00", duration: 1, customerName: "Loyal Player", customerPhone: U,
      basePrice: 1250, subtotal: 1250, totalPrice: 1250, paymentMethod: "venue", paymentStatus: "completed", status: "completed", ...over,
    } as any,
  });

beforeAll(async () => {
  await wipe();
  await makeUser(U, "Loyal Player");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("loyalty awards", () => {
  it("a completed, paid game earns price/100 points, once", async () => {
    const b = await booking();
    expect(await loyaltyService.awardForCompletedBooking(b as any)).toBe(true);
    expect(await loyaltyService.awardForCompletedBooking(b as any)).toBe(false); // replay changes nothing
    const o = await loyaltyService.overview(U, "2026-10-05");
    expect(o.remaining).toBe(12.5);
    expect(o.byType.games.nextExpiry).toBe("2026-12-01");
  });

  it("free-game bookings, unpaid games, guests and challenge games earn nothing", async () => {
    expect(await loyaltyService.awardForCompletedBooking((await booking({ notes: "FREE_MATCH" })) as any)).toBe(false);
    expect(await loyaltyService.awardForCompletedBooking((await booking({ paymentStatus: "pending" })) as any)).toBe(false);
    expect(await loyaltyService.awardForCompletedBooking((await booking({ userId: null, customerPhone: G })) as any)).toBe(false);
    expect(await loyaltyService.awardForCompletedBooking((await booking({ source: "challenge" })) as any)).toBe(false);
  });

  it("the owner's example: games + Rs. 10,000 of goods", async () => {
    const res = await api().post("/api/loyalty/goods-sale").set(bearer(adminToken())).send({ phone: U, amount: 10000, items: "drinks and shoes" });
    expect(res.status).toBe(201);
    expect(res.body.data.points).toBe(100);
    const o = await loyaltyService.overview(U, "2026-10-05");
    expect(o.remaining).toBe(112.5);
    expect(o.byType.goods.points).toBe(100);
  });

  it("only staff can record a goods sale", async () => {
    const res = await api().post("/api/loyalty/goods-sale").set(bearer(tokenFor(U))).send({ phone: U, amount: 500 });
    expect(res.status).toBe(403);
    expect((await api().post("/api/loyalty/goods-sale").send({ phone: U, amount: 500 })).status).toBe(401);
  });
});

describe("claiming a free game", () => {
  it("is refused when there are not enough points", async () => {
    const o = await loyaltyService.overview(U);
    const evening = o.shifts.find((s) => s.period === "Evening")!;
    expect(evening.cost).toBeGreaterThan(o.remaining);
    const res = await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Evening" });
    expect(res.status).toBe(409);
  });

  it("rejects a bad shift and unauthenticated calls", async () => {
    expect((await api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Midnight" })).status).toBe(400);
    expect((await api().post("/api/loyalty/claim").send({ period: "Day" })).status).toBe(401);
  });

  it("two simultaneous claims cannot spend the same points twice", async () => {
    const day = (await loyaltyService.overview(U)).shifts.find((s) => s.period === "Day")!;
    expect(day.cost).toBe(100); // default Day price Rs. 1,000 / 10
    const [a, b] = await Promise.all([
      api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Day" }),
      api().post("/api/loyalty/claim").set(bearer(tokenFor(U))).send({ period: "Day" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const o = await loyaltyService.overview(U);
    expect(o.vouchers).toHaveLength(1);
    expect(o.remaining).toBe(12.5);
    expect(o.claimed).toBe(100);
  });

  it("a voucher can be used once, only by its owner and only for its shift", async () => {
    const v = (await loyaltyService.overview(U)).vouchers[0];
    await makeUser(G, "Other");
    await expect(prisma.$transaction((tx) => loyaltyService.useVoucher(tx, v.id, G, "b1", "Day"))).rejects.toThrow();
    await expect(prisma.$transaction((tx) => loyaltyService.useVoucher(tx, v.id, U, "b1", "Evening"))).rejects.toThrow();
    await prisma.$transaction((tx) => loyaltyService.useVoucher(tx, v.id, U, "b1", "Day"));
    await expect(prisma.$transaction((tx) => loyaltyService.useVoucher(tx, v.id, U, "b2", "Day"))).rejects.toThrow();
    await loyaltyService.releaseVoucherForBooking("b1");
    expect((await loyaltyService.overview(U)).vouchers).toHaveLength(1);
  });
});
