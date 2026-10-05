import { api, adminToken, bearer, futureDate, makeUser, prisma, tokenFor, wipeTestData } from "./helpers";
import { assertSafeDatabaseUrl } from "../src/config/env";

const OWNER = "9800000101";
const OTHER = "9800000102";
const GUEST = "9800000103";
const PHONES = [OWNER, OTHER, GUEST];

beforeAll(async () => {
  await wipeTestData(PHONES);
  await makeUser(OWNER, "Owner Player", { freeMatchesAvailable: 1 });
  await makeUser(OTHER, "Other Player");
});
afterAll(async () => {
  await wipeTestData(PHONES);
  await prisma.$disconnect();
});

describe("database safety guard", () => {
  it("refuses a remote database outside production", () => {
    expect(() => assertSafeDatabaseUrl("postgresql://u:p@ep-x.neon.tech/db", "development")).toThrow(/Refusing to start/);
    expect(() => assertSafeDatabaseUrl("postgresql://u:p@ep-x.neon.tech/db", "test")).toThrow(/Refusing to start/);
  });
  it("allows localhost, and allows anything in production", () => {
    expect(() => assertSafeDatabaseUrl("postgresql://u:p@localhost:5439/db", "development")).not.toThrow();
    expect(() => assertSafeDatabaseUrl("postgresql://u:p@ep-x.neon.tech/db", "production")).not.toThrow();
  });
});

describe("staff-only routes reject the public and customers", () => {
  const routes: [string, string][] = [
    ["get", "/api/bookings"],
    ["get", "/api/users/players"],
    ["get", `/api/users/players/${OWNER}/bookings`],
    ["get", "/api/tournaments/registrations"],
    ["get", "/api/expenses"],
    ["get", "/api/products/logs"],
    ["get", "/api/gamezone"],
    ["post", "/api/categories"],
    ["patch", "/api/settings"],
    ["get", "/api/membership/subscriptions"],
    ["post", "/api/membership/subscriptions/verify-payment"],
    ["post", "/api/notifications/send-sms"],
  ];

  it.each(routes)("%s %s -> 401 without a token", async (method, url) => {
    const res = await (api() as any)[method](url).send({});
    expect(res.status).toBe(401);
  });

  it.each(routes)("%s %s -> 403 for a customer", async (method, url) => {
    const res = await (api() as any)[method](url).set(bearer(tokenFor(OWNER))).send({});
    expect(res.status).toBe(403);
  });

  it("lets staff list bookings", async () => {
    const res = await api().get("/api/bookings").set(bearer(adminToken()));
    expect(res.status).toBe(200);
  });

  it("PATCH /api/bookings/:id cannot mark a booking paid without staff rights", async () => {
    const res = await api().patch("/api/bookings/anything").send({ paymentStatus: "completed" });
    expect(res.status).toBe(401);
  });
});

describe("customers cannot change prices or fake a payment", () => {
  it("ignores overridePrice, addOnsPrice and discountAmount from a customer", async () => {
    const res = await api()
      .post("/api/bookings")
      .set(bearer(tokenFor(OWNER)))
      .send({ date: futureDate(3), startTime: "10:00", duration: 1, paymentMethod: "venue", overridePrice: 0, addOnsPrice: -500, discountAmount: 9999 });
    expect(res.status).toBe(201);
    expect(res.body.data.totalPrice).toBeGreaterThan(0);
    expect(res.body.data.discountAmount).toBe(0);
    expect(res.body.data.addOnsPrice).toBe(0);
  });

  it("staff can still override the price (manual bookings)", async () => {
    const res = await api()
      .post("/api/bookings")
      .set(bearer(adminToken()))
      .send({ date: futureDate(3), startTime: "11:00", duration: 1, paymentMethod: "venue", overridePrice: 700, customerName: "Walk In", customerPhone: GUEST });
    expect(res.status).toBe(201);
    expect(res.body.data.totalPrice).toBe(700);
  });

  it("choosing 'full' payment does not mark the booking paid", async () => {
    const res = await api()
      .post("/api/bookings")
      .send({ date: futureDate(3), startTime: "12:00", duration: 1, paymentMethod: "full", customerName: "Walk In", customerPhone: GUEST });
    expect(res.status).toBe(201);
    expect(res.body.data.paymentStatus).toBe("pending");
    expect(res.body.data.amountPaidNow).toBe(0);
    expect(res.body.data.status).not.toBe("completed");
  });

  it("a guest cannot spend another player's free match by typing their phone number", async () => {
    const res = await api()
      .post("/api/bookings")
      .send({ date: futureDate(3), startTime: "13:00", duration: 1, paymentMethod: "venue", customerName: "Owner Player", customerPhone: OWNER, useFreeMatch: true });
    expect(res.status).toBe(400);
    const owner = await prisma.user.findUnique({ where: { phoneNumber: OWNER } });
    expect(owner?.freeMatchesAvailable).toBe(1);
  });
});

describe("booking privacy", () => {
  let bookingId = "";
  beforeAll(async () => {
    const res = await api()
      .post("/api/bookings")
      .set(bearer(tokenFor(OWNER)))
      .send({ date: futureDate(4), startTime: "14:00", duration: 1, paymentMethod: "venue" });
    bookingId = res.body.data.id;
  });

  it("only the owner or staff can read a booking", async () => {
    expect((await api().get(`/api/bookings/${bookingId}`)).status).toBe(401);
    expect((await api().get(`/api/bookings/${bookingId}`).set(bearer(tokenFor(OTHER)))).status).toBe(403);
    expect((await api().get(`/api/bookings/${bookingId}`).set(bearer(tokenFor(OWNER)))).status).toBe(200);
    expect((await api().get(`/api/bookings/${bookingId}`).set(bearer(adminToken()))).status).toBe(200);
  });

  it("the public occupancy calendar hides names and phone numbers", async () => {
    const res = await api().get(`/api/bookings/occupancy?date=${futureDate(4)}`);
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body.data);
    expect(text).not.toContain("customerName");
    expect(text).not.toContain("customerPhone");
    expect(res.body.data.bookings.length).toBeGreaterThan(0);
  });

  it("staff still see full occupancy details", async () => {
    const res = await api().get(`/api/bookings/occupancy?date=${futureDate(4)}`).set(bearer(adminToken()));
    expect(JSON.stringify(res.body.data)).toContain("customerName");
  });

  it("my bookings returns only my own", async () => {
    const mine = await api().get("/api/bookings/me").set(bearer(tokenFor(OWNER)));
    const theirs = await api().get("/api/bookings/me").set(bearer(tokenFor(OTHER)));
    expect(mine.status).toBe(200);
    expect(JSON.stringify(mine.body.data)).toContain(bookingId);
    expect(JSON.stringify(theirs.body.data)).not.toContain(bookingId);
  });

  it("cancelling keeps the record as cancelled instead of deleting it", async () => {
    const res = await api().post(`/api/bookings/${bookingId}/cancel`).set(bearer(tokenFor(OWNER)));
    expect(res.status).toBe(200);
    const row = await prisma.booking.findUnique({ where: { id: bookingId } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe("cancelled");
  });
});
