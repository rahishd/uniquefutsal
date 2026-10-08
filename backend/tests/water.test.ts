import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";
import { waterFor } from "../src/utils/water";

const A = "9800000931";
const NO_WATER = "WATERNO10";
const WITH_WATER = "WATERYES10";

let savedPromos: string | null = null;

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { userId: A }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.vipCode.deleteMany({ where: { userId: A } });
  await prisma.notification.deleteMany({ where: { userId: A } });
  await prisma.user.deleteMany({ where: { phoneNumber: A } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Water Player");
  savedPromos = (await prisma.settings.findUnique({ where: { key: "promoCodes" } }))?.value ?? null;
  const promos = [
    { code: NO_WATER, type: "percent", value: 10, label: "10% off", appliedTo: "booking", isActive: true },
    { code: WITH_WATER, type: "percent", value: 10, label: "10% off", appliedTo: "booking", isActive: true, includesWater: true },
  ];
  await prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(promos) }, create: { key: "promoCodes", value: JSON.stringify(promos) } });
});
afterAll(async () => {
  if (savedPromos === null) await prisma.settings.deleteMany({ where: { key: "promoCodes" } });
  else await prisma.settings.update({ where: { key: "promoCodes" }, data: { value: savedPromos } });
  await wipe();
});
beforeEach(() => prisma.vipCode.deleteMany({ where: { userId: A } }));

const quote = (code?: string) => api().post("/api/bookings/quote").set(bearer(tokenFor(A))).send({ date: futureDate(3), startTime: "16:00", promoCode: code });
let hour = 6;
const checkout = (code?: string) =>
  api().post("/api/bookings/checkout").set(bearer(tokenFor(A))).send({ date: futureDate(6), startTime: `${String(hour++).padStart(2, "0")}:00`, method: "venue", promoCode: code });
const lastBottles = async () => (await prisma.booking.findFirstOrThrow({ where: { userId: A }, orderBy: { createdAt: "desc" } })).waterBottles;

describe("complimentary mineral water", () => {
  it("the rule: 2 bottles, none with a VIP discount, none with a promo unless staff allowed it", () => {
    expect(waterFor({ vip: false, promo: null })).toEqual({ bottles: 2, excluded: null });
    expect(waterFor({ vip: true, promo: null })).toEqual({ bottles: 0, excluded: "vip" });
    expect(waterFor({ vip: true, promo: { includesWater: true } })).toEqual({ bottles: 0, excluded: "vip" });
    expect(waterFor({ vip: false, promo: {} })).toEqual({ bottles: 0, excluded: "promo" });
    expect(waterFor({ vip: false, promo: { includesWater: true } })).toEqual({ bottles: 2, excluded: null });
  });

  it("a plain booking includes 2 bottles", async () => {
    const q = await quote();
    expect(q.body.data.water).toEqual({ bottles: 2, excluded: null });
    expect((await checkout()).status).toBeLessThan(300);
    expect(await lastBottles()).toBe(2);
  });

  it("a promo code removes the water, unless that code has the water switch on", async () => {
    expect((await quote(NO_WATER)).body.data.water).toEqual({ bottles: 0, excluded: "promo" });
    expect((await checkout(NO_WATER)).status).toBeLessThan(300);
    expect(await lastBottles()).toBe(0);

    expect((await quote(WITH_WATER)).body.data.water).toEqual({ bottles: 2, excluded: null });
    expect((await checkout(WITH_WATER)).status).toBeLessThan(300);
    expect(await lastBottles()).toBe(2);

    // a code that is not valid changes nothing
    expect((await quote("NOSUCHCODE")).body.data.water).toEqual({ bottles: 2, excluded: null });
  });

  it("a VIP discount never includes water, even with a promo that would", async () => {
    await prisma.vipCode.create({ data: { userId: A, code: "ADMINVIP", type: "percent", value: 20, createdBy: "staff-1", claimedAt: new Date() } });
    expect((await quote()).body.data.water).toEqual({ bottles: 0, excluded: "vip" });
    expect((await checkout()).status).toBeLessThan(300);
    expect(await lastBottles()).toBe(0);
    // VIP 20% beats the 10% promo, so the VIP rule decides
    expect((await quote(WITH_WATER)).body.data.water).toEqual({ bottles: 0, excluded: "vip" });
  });

  it("the public promo list says when water is not included", async () => {
    const list = (await api().get("/api/promos")).body.data as { code: string; terms: string }[];
    expect(list.find((p) => p.code === NO_WATER)?.terms).toContain("Mineral water is not included");
    expect(list.find((p) => p.code === WITH_WATER)?.terms ?? "").not.toContain("Mineral water is not included");
  });
});
