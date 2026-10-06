import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000801";
const B = "9800000802";
const CODE = "RULETEST10";
const OTHER = "RULETEST20";

let savedPromos: string | null = null;

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { userId: { in: [A, B] } }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.customerPromoRule.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Blocked Player");
  await makeUser(B, "Other Player");
  savedPromos = (await prisma.settings.findUnique({ where: { key: "promoCodes" } }))?.value ?? null;
  const promos = [CODE, OTHER].map((code, i) => ({ code, type: "percent", value: 10 * (i + 1), label: `${10 * (i + 1)}% off`, appliedTo: "booking", isActive: true }));
  await prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(promos) }, create: { key: "promoCodes", value: JSON.stringify(promos) } });
});
afterAll(async () => {
  if (savedPromos === null) await prisma.settings.deleteMany({ where: { key: "promoCodes" } });
  else await prisma.settings.update({ where: { key: "promoCodes" }, data: { value: savedPromos } });
  await wipe();
});

const quote = (code: string, token?: string) => {
  const r = api().post("/api/bookings/quote");
  return (token ? r.set(bearer(token)) : r).send({ date: futureDate(3), startTime: "16:00", promoCode: code });
};
const checkout = (code: string, phone: string, hour: string) =>
  api().post("/api/bookings/checkout").set(bearer(tokenFor(phone))).send({ date: futureDate(4), startTime: hour, method: "venue", promoCode: code });
const block = (userId: string, code: string) => prisma.customerPromoRule.create({ data: { userId, code, createdBy: "staff-1" } });

describe("promo codes switched off for one customer", () => {
  it("works for everyone until staff switch it off", async () => {
    expect((await quote(CODE, tokenFor(A))).body.data.promo.ok).toBe(true);
    expect((await quote(CODE)).body.data.promo.ok).toBe(true);
  });

  it("a blocked code is refused for that customer only, in the quote and in the real booking, and the choice is remembered", async () => {
    await block(A, CODE);
    const q = await quote(CODE, tokenFor(A));
    expect(q.body.data.promo.ok).toBe(false);
    expect(q.body.data.promo.message).toMatch(/not available for your account/);
    expect(q.body.data.total).toBe(q.body.data.basePrice);

    const refused = await checkout(CODE, A, "17:00");
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/not available for your account/);
    expect(await prisma.booking.count({ where: { userId: A } })).toBe(0);

    // another code, another customer, and a guest are all unaffected
    expect((await quote(OTHER, tokenFor(A))).body.data.promo.ok).toBe(true);
    expect((await quote(CODE, tokenFor(B))).body.data.promo.ok).toBe(true);
    expect((await quote(CODE)).body.data.promo.ok).toBe(true);

    // still blocked on a later booking, then allowed again once staff switch it back on
    expect((await checkout(CODE, A, "18:00")).status).toBe(400);
    await prisma.customerPromoRule.deleteMany({ where: { userId: A, code: CODE } });
    const ok = await checkout(CODE, A, "18:00");
    expect(ok.status).toBe(201);
    expect(ok.body.data.booking.discountAmount ?? ok.body.data.booking.discount).toBeGreaterThan(0);
  });

  it("'*' switches every promo code off for that customer", async () => {
    await block(B, "*");
    expect((await quote(CODE, tokenFor(B))).body.data.promo.ok).toBe(false);
    expect((await quote(OTHER, tokenFor(B))).body.data.promo.ok).toBe(false);
    expect((await checkout(OTHER, B, "19:00")).status).toBe(400);
    // a booking with no promo code still works
    expect((await checkout("", B, "19:00")).status).toBe(201);
  });

  it("the Promos page hides switched-off codes from the signed-in customer", async () => {
    const mine = await api().get("/api/promos").set(bearer(tokenFor(A)));
    expect(mine.body.data.map((p: { code: string }) => p.code)).toEqual(expect.arrayContaining([CODE, OTHER]));
    await block(A, OTHER);
    const after = await api().get("/api/promos").set(bearer(tokenFor(A)));
    const codes = after.body.data.map((p: { code: string }) => p.code);
    expect(codes).toContain(CODE);
    expect(codes).not.toContain(OTHER);
    const blockedAll = await api().get("/api/promos").set(bearer(tokenFor(B)));
    expect(blockedAll.body.data).toEqual([]);
    const guest = await api().get("/api/promos");
    expect(guest.body.data.map((p: { code: string }) => p.code)).toEqual(expect.arrayContaining([CODE, OTHER]));
  });

  it("the promo check endpoint follows the same rule", async () => {
    const r = await api().post("/api/promos/validate").set(bearer(tokenFor(B))).send({ code: CODE, date: futureDate(3), startTime: "16:00" });
    expect(r.body.data.promo.ok).toBe(false);
  });
});
