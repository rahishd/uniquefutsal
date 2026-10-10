import { api, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const U = "9800000901";

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { userId: U }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: U } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { phoneNumber: U } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(U, "Slot Tester");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("GET /api/bookings/slots (the booking page)", () => {
  it("lists only free slots with their price, for today up to 10 days ahead", async () => {
    const res = await api().get(`/api/bookings/slots?date=${futureDate(3)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
    const s = res.body.data.slots[0];
    expect(s).toMatchObject({ startTime: expect.stringMatching(/^\d\d:00$/), price: expect.any(Number) });
    expect(s.price).toBeGreaterThan(0);
    expect((await api().get(`/api/bookings/slots?date=${futureDate(11)}`)).status).toBe(400);
    expect((await api().get(`/api/bookings/slots?date=${futureDate(-1)}`)).status).toBe(400);
    expect((await api().get("/api/bookings/slots?date=not-a-date")).status).toBe(400);
  });

  it("a booked hour disappears from the list", async () => {
    const date = futureDate(5);
    const before = (await api().get(`/api/bookings/slots?date=${date}`)).body.data.slots.map((x: any) => x.startTime);
    expect(before).toContain("14:00");
    const book = await api().post("/api/bookings/checkout").set(bearer(tokenFor(U))).send({ date, startTime: "14:00", method: "venue" });
    expect(book.status).toBe(201);
    const after = (await api().get(`/api/bookings/slots?date=${date}`)).body.data.slots.map((x: any) => x.startTime);
    expect(after).not.toContain("14:00");
  });
});

describe("hours the venue has closed", () => {
  const date = futureDate(6);
  afterEach(async () => {
    await prisma.slotBlock.deleteMany({ where: { date } });
  });

  it("are not offered, are listed with the reason, and a booking attempt says why", async () => {
    await prisma.slotBlock.create({ data: { date, hour: 11, reason: "Repair & Renovation", createdBy: "test" } });
    const res = await api().get(`/api/bookings/slots?date=${date}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slots.map((x: any) => x.startTime)).not.toContain("11:00");
    expect(res.body.data.blocked).toEqual([expect.objectContaining({ hour: 11, startTime: "11:00", reason: "Repair & Renovation" })]);
    const book = await api().post("/api/bookings/checkout").set(bearer(tokenFor(U))).send({ date, startTime: "11:00", method: "venue" });
    expect(book.status).toBe(400);
    expect(JSON.stringify(book.body)).toContain("Repair & Renovation");
  });
});
