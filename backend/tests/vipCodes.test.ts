import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000901";
const B = "9800000902";
const VIP = "ADMINVIP";
const NORMAL = "VIPTEST50";
const SMALL = "VIPTEST05";

let savedPromos: string | null = null;

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { userId: { in: [A, B] } }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.vipCode.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}
const giveVip = (userId: string, extra: object = {}) => prisma.vipCode.create({ data: { userId, code: VIP, type: "percent", value: 10, createdBy: "staff-1", ...extra } });

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Vip Player");
  await makeUser(B, "Plain Player");
  savedPromos = (await prisma.settings.findUnique({ where: { key: "promoCodes" } }))?.value ?? null;
  const promos = [[NORMAL, 50], [SMALL, 5]].map(([code, value]) => ({ code, type: "percent", value, label: `${value}% off`, appliedTo: "booking", isActive: true }));
  await prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(promos) }, create: { key: "promoCodes", value: JSON.stringify(promos) } });
});
afterAll(async () => {
  if (savedPromos === null) await prisma.settings.deleteMany({ where: { key: "promoCodes" } });
  else await prisma.settings.update({ where: { key: "promoCodes" }, data: { value: savedPromos } });
  await wipe();
});
beforeEach(async () => {
  await prisma.vipCode.deleteMany({ where: { userId: { in: [A, B] } } });
});

const quote = (phone: string | null, code?: string) => {
  const r = api().post("/api/bookings/quote");
  return (phone ? r.set(bearer(tokenFor(phone))) : r).send({ date: futureDate(3), startTime: "16:00", promoCode: code });
};
let hour = 6;
const checkout = (phone: string, code?: string) =>
  api().post("/api/bookings/checkout").set(bearer(tokenFor(phone))).send({ date: futureDate(5), startTime: `${String(hour++).padStart(2, "0")}:00`, method: "venue", promoCode: code });
const lastBooking = (phone: string) => prisma.booking.findFirstOrThrow({ where: { userId: phone }, orderBy: { createdAt: "desc" } });

describe("VIP code: the customer types it once, then every game is discounted", () => {
  it("does nothing until the customer types the code", async () => {
    await giveVip(A);
    const q = await quote(A);
    expect(q.body.data.vip).toBeNull();
    expect(q.body.data.discount).toBe(0);
    expect((await prisma.vipCode.findFirstOrThrow({ where: { userId: A } })).claimedAt).toBeNull();
  });

  it("typing it gives the discount at once and claims it; after that it applies with nothing to type", async () => {
    await giveVip(A);
    const typed = await quote(A, "adminvip");
    const base = typed.body.data.basePrice;
    expect(typed.body.data.promo).toEqual({ ok: true, code: VIP, label: "VIP 10% off" });
    expect(typed.body.data.vip).toEqual({ code: VIP, label: "VIP 10% off" });
    expect(typed.body.data.discount).toBe(Math.round(base * 0.1));
    expect(typed.body.data.total).toBe(base - Math.round(base * 0.1));
    expect((await prisma.vipCode.findFirstOrThrow({ where: { userId: A } })).claimedAt).not.toBeNull();

    const auto = await quote(A);
    expect(auto.body.data.vip?.code).toBe(VIP);
    expect(auto.body.data.promo).toBeNull();
    expect(auto.body.data.discount).toBe(typed.body.data.discount);
  });

  it("is applied to every booking, every time, and is recorded on the booking", async () => {
    await giveVip(A);
    const first = await checkout(A, VIP);
    expect(first.status).toBe(201);
    const b1 = await lastBooking(A);
    expect(b1.promoCode).toBe(VIP);
    expect(b1.discountAmount).toBe(Math.round(b1.basePrice * 0.1));
    expect(b1.totalPrice).toBe(b1.basePrice - b1.discountAmount);

    for (let i = 0; i < 2; i++) {
      expect((await checkout(A)).status).toBe(201); // nothing typed
      const b = await lastBooking(A);
      expect(b.promoCode).toBe(VIP);
      expect(b.discountAmount).toBe(Math.round(b.basePrice * 0.1));
    }
  });

  it("a rupee amount works and never goes below zero", async () => {
    await giveVip(A, { type: "flat", value: 300, claimedAt: new Date() });
    const q = await quote(A);
    expect(q.body.data.discount).toBe(Math.min(300, q.body.data.basePrice));
    await prisma.vipCode.updateMany({ where: { userId: A }, data: { value: 99999 } });
    const big = await quote(A);
    expect(big.body.data.total).toBe(0);
    expect(big.body.data.discount).toBe(big.body.data.basePrice);
  });

  it("the bigger discount wins when a normal promo code is typed too", async () => {
    await giveVip(A, { claimedAt: new Date() });
    const bigPromo = await quote(A, NORMAL); // 50% beats VIP 10%
    expect(bigPromo.body.data.promo.code).toBe(NORMAL);
    expect(bigPromo.body.data.vip).toBeNull();
    expect(bigPromo.body.data.discount).toBe(Math.round(bigPromo.body.data.basePrice * 0.5));

    const smallPromo = await quote(A, SMALL); // 5% loses to VIP 10%
    expect(smallPromo.body.data.promo.code).toBe(VIP);
    expect(smallPromo.body.data.vip?.code).toBe(VIP);
    expect(smallPromo.body.data.discount).toBe(Math.round(smallPromo.body.data.basePrice * 0.1));

    expect((await checkout(A, NORMAL)).status).toBe(201);
    expect((await lastBooking(A)).promoCode).toBe(NORMAL);
    expect((await checkout(A, SMALL)).status).toBe(201);
    expect((await lastBooking(A)).promoCode).toBe(VIP);
  });

  it("a wrong code is still reported, while the VIP discount keeps applying", async () => {
    await giveVip(A, { claimedAt: new Date() });
    const q = await quote(A, "NOPE");
    expect(q.body.data.promo.ok).toBe(false);
    expect(q.body.data.vip?.code).toBe(VIP);
    expect(q.body.data.discount).toBeGreaterThan(0);
    expect((await checkout(A)).status).toBe(201); // the app sends no code when the typed one failed
    expect((await lastBooking(A)).promoCode).toBe(VIP);
  });

  it("only the customer it was given to can use it; paused or removed codes stop working", async () => {
    await giveVip(A, { claimedAt: new Date() });
    // another customer, and a guest, typing the same text get the normal "invalid" answer
    expect((await quote(B, VIP)).body.data.promo).toEqual({ ok: false, message: "This promo code is invalid." });
    expect((await quote(null, VIP)).body.data.promo.ok).toBe(false);
    expect((await checkout(B, VIP)).status).toBe(400);

    await prisma.vipCode.updateMany({ where: { userId: A }, data: { active: false } });
    const paused = await quote(A);
    expect(paused.body.data.vip).toBeNull();
    expect(paused.body.data.discount).toBe(0);
    expect((await quote(A, VIP)).body.data.promo.ok).toBe(false);

    await prisma.vipCode.updateMany({ where: { userId: A }, data: { active: true } });
    expect((await quote(A)).body.data.vip?.code).toBe(VIP);
    await prisma.vipCode.deleteMany({ where: { userId: A } });
    expect((await quote(A)).body.data.discount).toBe(0);
  });

  it("the promo check endpoint knows the VIP code too", async () => {
    await giveVip(A);
    const r = await api().post("/api/promos/validate").set(bearer(tokenFor(A))).send({ code: VIP, date: futureDate(3), startTime: "16:00" });
    expect(r.body.data.promo.ok).toBe(true);
    expect(r.body.data.discount).toBeGreaterThan(0);
  });
});
