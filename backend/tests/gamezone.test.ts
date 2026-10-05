import { api, adminToken, bearer, futureDate, makeUser, prisma, tokenFor } from "./helpers";

const REG = "9800000401";
const GUEST = "9800000402";

async function wipe() {
  const codes = (await prisma.gzBooking.findMany({ where: { OR: [{ userId: REG }, { guestPhone: GUEST }] }, select: { code: true } })).map((b) => b.code);
  await prisma.gzSlot.deleteMany({ where: { bookingCode: { in: codes } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: codes } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: codes } } });
  await prisma.gzBooking.deleteMany({ where: { code: { in: codes } } });
  await prisma.notification.deleteMany({ where: { userId: REG } });
  await prisma.user.deleteMany({ where: { phoneNumber: REG } });
}

let consoles: { id: string; name: string }[] = [];

beforeAll(async () => {
  await wipe();
  await makeUser(REG, "Gamer One");
  const cat = await api().get("/api/gamezone/catalog");
  consoles = cat.body.data.consoles;
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const book = (body: object, token?: string) => {
  const r = api().post("/api/gamezone/bookings");
  return (token ? r.set(bearer(token)) : r).send(body);
};

describe("catalog", () => {
  it("has the 2 consoles, the 4 demo games and the 3 plans", async () => {
    const res = await api().get("/api/gamezone/catalog");
    expect(res.body.data.consoles.map((c: any) => c.name)).toEqual(["PS5 Station 1", "PS5 Station 2"]);
    expect(res.body.data.games.map((g: any) => g.title).sort()).toEqual(["FIFA 26", "Forza Horizon", "GTA 5", "Red Dead Redemption"]);
    expect(res.body.data.plans.map((p: any) => [p.players, p.ratePerPersonHour])).toEqual([[1, 300], [2, 200], [4, 150]]);
    expect(res.body.data.maxHours).toBe(4);
  });
});

describe("price is rate x players x hours, set by the server", () => {
  it.each([
    [0, 1, 1, 300],
    [1, 2, 1, 400],
    [2, 4, 1, 600],
    [3, 4, 4, 2400],
    [4, 2, 3, 1200],
  ])("case %i: %i players for %i hr = Rs. %i", async (i, players, hours, total) => {
    const res = await book({ date: futureDate(i + 1), hour: 10, hours, players, consoleId: consoles[1].id, game: "FIFA 26", method: "venue" }, tokenFor(REG));
    expect(res.status).toBe(201);
    expect(res.body.data.booking.total).toBe(total);
  });

  it("ignores a price sent by the browser", async () => {
    const res = await book({ date: futureDate(9), hour: 12, hours: 1, players: 1, consoleId: consoles[0].id, game: "GTA 5", method: "venue", total: 1 }, tokenFor(REG));
    expect(res.status).toBe(201);
    expect(res.body.data.booking.total).toBe(300);
  });
});

describe("each console has its own free times", () => {
  it("booking console 1 does not take console 2's hour, and does take console 1's", async () => {
    const date = futureDate(3);
    const before1 = (await api().get(`/api/gamezone/slots?date=${date}&hours=1&consoleId=${consoles[0].id}`)).body.data.hours;
    const before2 = (await api().get(`/api/gamezone/slots?date=${date}&hours=1&consoleId=${consoles[1].id}`)).body.data.hours;
    expect(before1).toContain(15);
    expect(before2).toContain(15);
    const res = await book({ date, hour: 15, hours: 1, players: 2, consoleId: consoles[0].id, game: "Forza Horizon", method: "venue" }, tokenFor(REG));
    expect(res.status).toBe(201);
    const after1 = (await api().get(`/api/gamezone/slots?date=${date}&hours=1&consoleId=${consoles[0].id}`)).body.data.hours;
    const after2 = (await api().get(`/api/gamezone/slots?date=${date}&hours=1&consoleId=${consoles[1].id}`)).body.data.hours;
    expect(after1).not.toContain(15);
    expect(after2).toContain(15);
  });

  it("a long session needs every hour free on that console", async () => {
    const date = futureDate(3);
    const hours3 = (await api().get(`/api/gamezone/slots?date=${date}&hours=3&consoleId=${consoles[0].id}`)).body.data.hours;
    expect(hours3).not.toContain(13); // 13,14,15 would overlap the booked 15:00 hour
    expect(hours3).not.toContain(15);
    expect(hours3).toContain(16);
    const clash = await book({ date, hour: 14, hours: 2, players: 1, consoleId: consoles[0].id, game: "GTA 5", method: "venue" }, tokenFor(REG));
    expect(clash.status).toBe(409);
  });
});

describe("rules", () => {
  const base = () => ({ date: futureDate(5), hour: 11, hours: 1, players: 1, consoleId: consoles[1].id, game: "GTA 5" });
  it("guests give details and pay online in full", async () => {
    expect((await book({ ...base(), method: "esewa" })).status).toBe(400);
    expect((await book({ ...base(), method: "venue", guest: { name: "Guest G", phone: GUEST } })).status).toBe(403);
    expect((await book({ ...base(), method: "esewa", guest: { name: "Guest G", phone: "123" } })).status).toBe(400);
  });
  it("the game must be on the list, hours 1 to 4, players 1/2/4, inside opening hours, within 10 days", async () => {
    expect((await book({ ...base(), game: "Not A Game", method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await book({ ...base(), hours: 5, method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await book({ ...base(), players: 3, method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await book({ ...base(), hour: 9, method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await book({ ...base(), hour: 21, hours: 2, method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await book({ ...base(), date: futureDate(11), method: "venue" }, tokenFor(REG))).status).toBe(400);
  });
  it("staff cannot book through the customer endpoint", async () => {
    expect((await book({ ...base(), method: "venue" }, adminToken())).status).toBe(403);
  });
});

describe("online payment, expiry and cancel", () => {
  it("guest pays by QR: held, then confirmed by the verified payment", async () => {
    const res = await book({ date: futureDate(6), hour: 18, hours: 2, players: 2, consoleId: consoles[0].id, game: "FIFA 26", method: "fonepay", guest: { name: "Guest G", phone: GUEST } });
    expect(res.status).toBe(201);
    const { booking, payment } = res.body.data;
    expect(booking.total).toBe(800);
    expect(payment.amount).toBe(800);
    expect(payment.remarks).toBe(`Gamezone PS5 - ${booking.code}`);
    const pay = await api().post(`/api/payments/${booking.code}/test-pay`);
    expect(pay.status).toBe(200);
    const row = await prisma.gzBooking.findUnique({ where: { code: booking.code } });
    expect(row?.paymentStatus).toBe("paid");
  });

  it("an unpaid QR expires and frees the console", async () => {
    const slot = { date: futureDate(6), hour: 11, hours: 1, players: 1, consoleId: consoles[0].id, game: "GTA 5", method: "esewa", guest: { name: "Guest G", phone: GUEST } };
    const res = await book(slot);
    const code = res.body.data.booking.code;
    expect((await book({ ...slot, guest: { name: "Guest G", phone: GUEST } })).status).toBe(409); // held
    await prisma.paymentOrder.update({ where: { orderCode: code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const st = await api().get(`/api/payments/${code}/status?phone=${GUEST}`);
    expect(st.body.data.status).toBe("expired");
    expect((await prisma.gzBooking.findUnique({ where: { code } }))?.status).toBe("expired");
    expect((await book(slot)).status).toBe(201);
  });

  it("a registered customer can cancel before the session; the record stays", async () => {
    const res = await book({ date: futureDate(7), hour: 20, hours: 1, players: 1, consoleId: consoles[1].id, game: "GTA 5", method: "venue" }, tokenFor(REG));
    const code = res.body.data.booking.code;
    expect((await api().post(`/api/gamezone/bookings/${code}/cancel`)).status).toBe(401);
    const c = await api().post(`/api/gamezone/bookings/${code}/cancel`).set(bearer(tokenFor("9800000499")));
    expect(c.status).toBe(404); // not theirs
    expect((await api().post(`/api/gamezone/bookings/${code}/cancel`).set(bearer(tokenFor(REG)))).status).toBe(200);
    const row = await prisma.gzBooking.findUnique({ where: { code } });
    expect(row?.status).toBe("cancelled");
    expect(await prisma.gzSlot.count({ where: { bookingCode: code } })).toBe(0);
    const mine = await api().get("/api/gamezone/bookings/me").set(bearer(tokenFor(REG)));
    expect(JSON.stringify(mine.body.data)).toContain(code);
  });

  it("staff mark a venue session as paid; customers cannot", async () => {
    const res = await book({ date: futureDate(8), hour: 13, hours: 1, players: 1, consoleId: consoles[1].id, game: "GTA 5", method: "venue" }, tokenFor(REG));
    const code = res.body.data.booking.code;
    expect((await api().post(`/api/gamezone/admin/bookings/${code}/mark-paid`).set(bearer(tokenFor(REG)))).status).toBe(403);
    expect((await api().post(`/api/gamezone/admin/bookings/${code}/mark-paid`).set(bearer(adminToken()))).status).toBe(200);
    expect((await prisma.gzBooking.findUnique({ where: { code } }))?.paymentStatus).toBe("paid");
  });
});

describe("two people booking the same console hour at once", () => {
  it("only one wins", async () => {
    await makeUser("9800000403", "Racer A");
    await makeUser("9800000404", "Racer B");
    const body = { date: futureDate(9), hour: 17, hours: 1, players: 1, consoleId: consoles[0].id, game: "GTA 5", method: "venue" };
    const [a, b] = await Promise.all([book(body, tokenFor("9800000403")), book(body, tokenFor("9800000404"))]);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    const codes = (await prisma.gzBooking.findMany({ where: { userId: { in: ["9800000403", "9800000404"] } }, select: { code: true } })).map((x) => x.code);
    await prisma.gzSlot.deleteMany({ where: { bookingCode: { in: codes } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ["9800000403", "9800000404"] } } });
    await prisma.gzBooking.deleteMany({ where: { code: { in: codes } } });
    await prisma.user.deleteMany({ where: { phoneNumber: { in: ["9800000403", "9800000404"] } } });
  });
});

describe("staff-managed catalog", () => {
  it("staff can add a game and change a rate; customers cannot", async () => {
    expect((await api().post("/api/gamezone/admin/games").set(bearer(tokenFor(REG))).send({ title: "Tekken 8" })).status).toBe(403);
    const add = await api().post("/api/gamezone/admin/games").set(bearer(adminToken())).send({ title: "Tekken 8" });
    expect(add.status).toBe(201);
    let cat = await api().get("/api/gamezone/catalog");
    expect(cat.body.data.games.map((g: any) => g.title)).toContain("Tekken 8");
    await api().patch(`/api/gamezone/admin/games/${add.body.data.id}`).set(bearer(adminToken())).send({ active: false });
    cat = await api().get("/api/gamezone/catalog");
    expect(cat.body.data.games.map((g: any) => g.title)).not.toContain("Tekken 8");
    await prisma.gzGame.deleteMany({ where: { title: "Tekken 8" } });

    const upd = await api().put("/api/gamezone/admin/plans/1").set(bearer(adminToken())).send({ ratePerPersonHour: 350 });
    expect(upd.body.data.ratePerPersonHour).toBe(350);
    await api().put("/api/gamezone/admin/plans/1").set(bearer(adminToken())).send({ ratePerPersonHour: 300 });
  });
});
