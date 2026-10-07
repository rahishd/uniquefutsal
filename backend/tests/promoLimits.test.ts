import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000911";
const B = "9800000912";
const C = "9800000913";
const CODE = "LIMIT2";

let savedPromos: string | null = null;
const setPromo = (extra: object) => {
  const promos = [{ code: CODE, type: "percent", value: 10, label: "10% off", appliedTo: "booking", isActive: true, ...extra }];
  return prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(promos) }, create: { key: "promoCodes", value: JSON.stringify(promos) } });
};
async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { userId: { in: [A, B, C] } }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B, C] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B, C] } } });
}
beforeAll(async () => {
  await wipe();
  for (const p of [A, B, C]) await makeUser(p, `Limit ${p.slice(-1)}`);
  savedPromos = (await prisma.settings.findUnique({ where: { key: "promoCodes" } }))?.value ?? null;
});
afterAll(async () => {
  if (savedPromos === null) await prisma.settings.deleteMany({ where: { key: "promoCodes" } });
  else await prisma.settings.update({ where: { key: "promoCodes" }, data: { value: savedPromos } });
  await wipe();
});

let hour = 5;
const checkout = (phone: string) => api().post("/api/bookings/checkout").set(bearer(tokenFor(phone))).send({ date: futureDate(6), startTime: `${String(hour++).padStart(2, "0")}:00`, method: "venue", promoCode: CODE });
const quote = (phone: string) => api().post("/api/bookings/quote").set(bearer(tokenFor(phone))).send({ date: futureDate(3), startTime: "16:00", promoCode: CODE });
const listed = async () => (await api().get("/api/promos")).body.data.some((p: { code: string }) => p.code === CODE);

describe("Promo code use limits", () => {
  it("stops a customer after their own limit and everyone after the total limit; cancelling gives a use back", async () => {
    await setPromo({ maxUses: 2, maxPerCustomer: 1 });
    expect(await listed()).toBe(true);

    expect((await checkout(A)).status).toBe(201);
    const again = await checkout(A);
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already used this promo code/);
    expect((await quote(A)).body.data.promo).toMatchObject({ ok: false });

    expect((await checkout(B)).status).toBe(201);
    expect(await listed()).toBe(false); // two uses made: no more offered
    const late = await checkout(C);
    expect(late.status).toBe(400);
    expect(late.body.message).toMatch(/fully used/);
    expect((await quote(C)).body.data.promo).toEqual({ ok: false, message: "This promo code has been fully used." });

    await prisma.booking.updateMany({ where: { userId: B }, data: { status: "cancelled" } });
    expect(await listed()).toBe(true);
    expect((await checkout(C)).status).toBe(201);
  });

  it("has no limit when none is set", async () => {
    await setPromo({});
    expect((await checkout(A)).status).toBe(201);
    expect((await checkout(A)).status).toBe(201);
    expect(await listed()).toBe(true);
  });
});
