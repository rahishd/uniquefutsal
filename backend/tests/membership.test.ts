import { api, bearer, futureDate, makeUser, prisma, tokenFor, adminToken } from "./helpers";

const M = "9800000501";
let planId = "";

async function wipe() {
  await prisma.notification.deleteMany({ where: { userId: M } });
  await prisma.membershipSubscription.deleteMany({ where: { userId: M } });
  await prisma.booking.deleteMany({ where: { userId: M } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: M } });
  await prisma.user.deleteMany({ where: { phoneNumber: M } });
  await prisma.membershipPlan.deleteMany({ where: { name: "TEST PLAN 501" } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(M, "Member");
  const p = await prisma.membershipPlan.create({ data: { name: "TEST PLAN 501", price: 5000, perks: JSON.stringify(["Priority"]), price1MonthMorning: 4000, discount1MonthMorning: 500, price3MonthsMorning: 11000 } });
  planId = p.id;
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const post = (url: string, body: object, token?: string) => {
  const r = api().post(url);
  return (token ? r.set(bearer(token)) : r).send(body);
};

it("lists plans with server-side prices", async () => {
  const r = await api().get("/api/membership/offers");
  const p = r.body.data.find((x: { id: string }) => x.id === planId);
  expect(p.prices["1_month"].morning).toBe(3500); // price minus the plan discount
  expect(p.prices["3_months"].morning).toBe(11000);
  expect(p.prices["1_month"].evening).toBeNull();
});

it("needs a sign-in, and ignores any price the browser sends", async () => {
  const body = { planId, timeSlot: "07:00-08:00", duration: "1_month", startDate: futureDate(1), totalPrice: 1 };
  expect((await post("/api/membership/request", body)).status).toBe(401);
  const r = await post("/api/membership/request", body, tokenFor(M));
  expect(r.status).toBe(201);
  expect(r.body.data.total).toBe(3500);
  const sub = await prisma.membershipSubscription.findFirst({ where: { userId: M } });
  expect(sub).toMatchObject({ status: "pending", totalPrice: 3500 });
});

it("refuses a second request, peak hours and unpriced times", async () => {
  const again = await post("/api/membership/request", { planId, timeSlot: "08:00-09:00", duration: "1_month", startDate: futureDate(1) }, tokenFor(M));
  expect(again.status).toBe(400);
  await prisma.membershipSubscription.deleteMany({ where: { userId: M } });
  const peak = await post("/api/membership/request", { planId, timeSlot: "17:00-18:00", duration: "1_month", startDate: futureDate(1) }, tokenFor(M));
  expect(peak.status).toBe(400);
  const unpriced = await post("/api/membership/request", { planId, timeSlot: "21:00-22:00", duration: "1_month", startDate: futureDate(1) }, tokenFor(M));
  expect(unpriced.status).toBe(400);
});

it("shows my membership and activates when staff verify the payment", async () => {
  const r = await post("/api/membership/request", { planId, timeSlot: "09:00-10:00", duration: "3_months", startDate: futureDate(1) }, tokenFor(M));
  expect(r.status).toBe(201);
  const mine = await api().get("/api/membership/mine").set(bearer(tokenFor(M)));
  expect(mine.body.data.current).toMatchObject({ plan: "TEST PLAN 501", status: "pending", total: 11000 });
  const v = await post("/api/membership/subscriptions/verify-payment", { subscriptionId: r.body.data.id }, adminToken());
  expect(v.status).toBeLessThan(300);
  const after = await api().get("/api/membership/mine").set(bearer(tokenFor(M)));
  expect(after.body.data.current.status).toBe("active");
  expect(await prisma.notification.count({ where: { userId: M, type: "membership" } })).toBe(3);
});
