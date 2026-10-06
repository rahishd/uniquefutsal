import { api, bearer, futureDate, makeUser, prisma, tokenFor, adminToken } from "./helpers";
import loyaltyService from "../src/modules/loyalty/loyalty.service";
import paymentService from "../src/modules/payment/payment.service";

const REG = "9800000301";
const GUEST = "9800000302";

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { OR: [{ userId: REG }, { customerPhone: { in: [REG, GUEST] } }] }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.paymentEvent.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.freeGameVoucher.deleteMany({ where: { userId: REG } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: REG } });
  await prisma.notification.deleteMany({ where: { userId: REG } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.user.deleteMany({ where: { phoneNumber: REG } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(REG, "Reg Player");
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const post = (url: string, body: object, token?: string) => {
  const r = api().post(url);
  return (token ? r.set(bearer(token)) : r).send(body);
};

describe("quote and promo check", () => {
  it("prices a slot on the server and explains a bad promo", async () => {
    const res = await post("/api/bookings/quote", { date: futureDate(2), startTime: "16:00", promoCode: "NOPE" });
    expect(res.status).toBe(200);
    expect(res.body.data.basePrice).toBeGreaterThan(0);
    expect(res.body.data.promo).toEqual({ ok: false, message: "This promo code is invalid." });
    expect(res.body.data.total).toBe(res.body.data.basePrice);
  });
  it("applies the booking window to quotes too", async () => {
    expect((await post("/api/bookings/quote", { date: futureDate(11), startTime: "16:00" })).status).toBe(400);
  });
  it("lists promos publicly", async () => {
    const res = await api().get("/api/promos");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("booking window", () => {
  it("allows today + 10 days and refuses day 11 and the past", async () => {
    expect((await post("/api/bookings/checkout", { date: futureDate(11), startTime: "17:00", method: "venue" }, tokenFor(REG))).status).toBe(400);
    expect((await post("/api/bookings/checkout", { date: futureDate(-1), startTime: "17:00", method: "venue" }, tokenFor(REG))).status).toBe(400);
    const ok = await post("/api/bookings/checkout", { date: futureDate(10), startTime: "17:00", method: "venue" }, tokenFor(REG));
    expect(ok.status).toBe(201);
  });
});

describe("registered customer", () => {
  it("pay at venue: booking reserved, no payment order, a notice for the customer", async () => {
    const res = await post("/api/bookings/checkout", { date: futureDate(2), startTime: "15:00", method: "venue" }, tokenFor(REG));
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toBeNull();
    expect(res.body.data.booking.status).toBe("pending");
    expect(res.body.data.booking.customerPhone).toBe(REG);
    const n = await prisma.notification.findMany({ where: { userId: REG, type: "booking" } });
    expect(n.length).toBeGreaterThan(0);
  });

  it("does not accept guest details from a signed-in customer", async () => {
    const res = await post("/api/bookings/checkout", { date: futureDate(2), startTime: "16:00", method: "venue", guest: { name: "X Y", phone: GUEST } }, tokenFor(REG));
    expect(res.status).toBe(400);
  });
});

describe("guest rules", () => {
  const base = { date: futureDate(3), startTime: "18:00" };
  it("must give a name and a valid mobile number", async () => {
    expect((await post("/api/bookings/checkout", { ...base, method: "fonepay" })).status).toBe(400);
    expect((await post("/api/bookings/checkout", { ...base, method: "fonepay", guest: { name: "A", phone: GUEST } })).status).toBe(400);
    expect((await post("/api/bookings/checkout", { ...base, method: "fonepay", guest: { name: "Guest One", phone: "12345" } })).status).toBe(400);
  });
  it("must pay online in full: pay at venue is refused", async () => {
    const res = await post("/api/bookings/checkout", { ...base, method: "venue", guest: { name: "Guest One", phone: GUEST } });
    expect(res.status).toBe(403);
  });
  it("cannot use a free-game voucher", async () => {
    const res = await post("/api/bookings/checkout", { ...base, method: "fonepay", voucherId: "x", guest: { name: "Guest One", phone: GUEST } });
    expect(res.status).toBe(403);
  });
});

describe("online payment lifecycle", () => {
  let code = "";
  const slot = { date: futureDate(4), startTime: "19:00" };

  it("creates a held booking and a QR for the exact amount", async () => {
    const res = await post("/api/bookings/checkout", { ...slot, method: "fonepay", guest: { name: "Guest One", phone: GUEST } });
    expect(res.status).toBe(201);
    const { booking, payment } = res.body.data;
    code = booking.id;
    expect(booking.status).toBe("pending");
    expect(booking.paymentStatus).toBe("pending");
    expect(payment.amount).toBe(booking.totalPrice);
    expect(payment.orderCode).toBe(booking.id);
    expect(payment.remarks).toBe(`Regular game - ${booking.id}`);
    expect(payment.qrPayload).toContain(`NPR ${booking.totalPrice}`);
  });

  it("holds the slot: nobody else can take it", async () => {
    const res = await post("/api/bookings/checkout", { ...slot, method: "fonepay", guest: { name: "Guest Two", phone: "9800000399" } });
    expect(res.status).toBe(400);
  });

  it("only the guest who made the order can see its status", async () => {
    expect((await api().get(`/api/payments/${code}/status`)).status).toBe(404);
    expect((await api().get(`/api/payments/${code}/status?phone=9800000399`)).status).toBe(404);
    const ok = await api().get(`/api/payments/${code}/status?phone=${GUEST}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe("pending");
  });

  it("the browser cannot confirm a payment", async () => {
    expect((await api().post(`/api/payments/${code}/mark-paid`)).status).toBe(401);
    expect((await api().post(`/api/payments/${code}/mark-paid`).set(bearer(tokenFor(REG)))).status).toBe(403);
    const b = await prisma.booking.findUnique({ where: { id: code } });
    expect(b?.paymentStatus).toBe("pending");
  });

  it("a wrong amount is rejected", async () => {
    await expect(paymentService.markPaid(code, { source: "gateway", amount: 1 })).rejects.toThrow(/does not match/);
  });

  it("the verified payment confirms the booking, once", async () => {
    const first = await api().post(`/api/payments/${code}/test-pay`);
    expect(first.status).toBe(200);
    expect(first.body.data.alreadyPaid).toBe(false);
    const again = await api().post(`/api/payments/${code}/test-pay`);
    expect(again.body.data.alreadyPaid).toBe(true);
    const b = await prisma.booking.findUnique({ where: { id: code } });
    expect(b?.paymentStatus).toBe("completed");
    expect(b?.status).toBe("confirmed");
    expect(b?.remainingAmount).toBe(0);
    const st = await api().get(`/api/payments/${code}/status?phone=${GUEST}`);
    expect(st.body.data.status).toBe("paid");
  });

  it("gateway webhooks are off until the merchant keys exist", async () => {
    expect((await api().post("/api/payments/webhooks/fonepay").send({})).status).toBe(501);
    expect((await api().post("/api/payments/webhooks/fonepay").send({})).status).toBe(501);
  });
});

describe("unpaid orders expire and free the slot", () => {
  it("after 10 minutes the booking is cancelled (kept as a record) and the slot is open again", async () => {
    const slot = { date: futureDate(5), startTime: "20:00" };
    const res = await post("/api/bookings/checkout", { ...slot, method: "fonepay", guest: { name: "Guest One", phone: GUEST } });
    const code = res.body.data.booking.id;
    await prisma.paymentOrder.update({ where: { orderCode: code }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const st = await api().get(`/api/payments/${code}/status?phone=${GUEST}`);
    expect(st.body.data.status).toBe("expired");
    const b = await prisma.booking.findUnique({ where: { id: code } });
    expect(b?.status).toBe("cancelled");
    expect(await prisma.bookingSlot.count({ where: { bookingId: code } })).toBe(0);

    const retry = await post("/api/bookings/checkout", { ...slot, method: "fonepay", guest: { name: "Guest One", phone: GUEST } });
    expect(retry.status).toBe(201);
  });

  it("the job expires everything that ran out of time", async () => {
    const slot = { date: futureDate(5), startTime: "21:00" };
    const res = await post("/api/bookings/checkout", { ...slot, method: "fonepay", guest: { name: "Guest One", phone: GUEST } });
    const code = res.body.data.booking.id;
    await prisma.paymentOrder.update({ where: { orderCode: code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await paymentService.expireDue()).toBeGreaterThanOrEqual(1);
    expect((await prisma.booking.findUnique({ where: { id: code } }))?.status).toBe("cancelled");
  });
});

describe("two people booking the same slot at the same moment", () => {
  it("only one wins", async () => {
    const slot = { date: futureDate(6), startTime: "14:00", method: "venue" };
    await makeUser("9800000303", "Racer One");
    await makeUser("9800000304", "Racer Two");
    const [a, b] = await Promise.all([
      post("/api/bookings/checkout", slot, tokenFor("9800000303")),
      post("/api/bookings/checkout", slot, tokenFor("9800000304")),
    ]);
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1);
    const rows = await prisma.bookingSlot.count({ where: { date: slot.date, hour: 14 } });
    expect(rows).toBe(1);
    for (const p of ["9800000303", "9800000304"]) {
      const ids = (await prisma.booking.findMany({ where: { userId: p }, select: { id: true } })).map((x) => x.id);
      await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
      await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
      await prisma.notification.deleteMany({ where: { userId: p } });
      await prisma.booking.deleteMany({ where: { userId: p } });
      await prisma.user.deleteMany({ where: { phoneNumber: p } });
    }
  });
});

describe("free game voucher at checkout", () => {
  let voucherId = "";
  let bookingId = "";
  it("earn points, claim a Day voucher, then book a Day slot for Rs. 0", async () => {
    await loyaltyService.recordGoodsSale({ phone: REG, amount: 10000, soldBy: "test" });
    const claim = await post("/api/loyalty/claim", { period: "Day" }, tokenFor(REG));
    expect(claim.status).toBe(201);
    voucherId = claim.body.data.id;

    const q = await post("/api/bookings/quote", { date: futureDate(7), startTime: "12:00", voucherId }, tokenFor(REG));
    expect(q.body.data.total).toBe(0);
    expect(q.body.data.usesVoucher).toBe(true);
    expect(q.body.data.earnPoints).toBe(0);

    const res = await post("/api/bookings/checkout", { date: futureDate(7), startTime: "12:00", method: "venue", voucherId }, tokenFor(REG));
    expect(res.status).toBe(201);
    bookingId = res.body.data.booking.id;
    expect(res.body.data.booking.totalPrice).toBe(0);
    expect(res.body.data.booking.status).toBe("confirmed");
    expect((await prisma.freeGameVoucher.findUnique({ where: { id: voucherId } }))?.status).toBe("used");
  });

  it("the voucher cannot be used twice, or for another shift", async () => {
    const again = await post("/api/bookings/checkout", { date: futureDate(7), startTime: "13:00", method: "venue", voucherId }, tokenFor(REG));
    expect(again.status).toBe(409);
    // the failed attempt left no active booking behind
    expect(await prisma.bookingSlot.count({ where: { date: futureDate(7), hour: 13 } })).toBe(0);
  });

  it("cancelling the free booking frees the slot and gives the voucher back", async () => {
    const res = await post(`/api/bookings/${bookingId}/cancel`, {}, tokenFor(REG));
    expect(res.status).toBe(200);
    expect((await prisma.freeGameVoucher.findUnique({ where: { id: voucherId } }))?.status).toBe("unused");
    expect(await prisma.bookingSlot.count({ where: { bookingId } })).toBe(0);
  });
});

describe("admin staff cancel keeps the record", () => {
  it("PATCH status cancelled soft-cancels instead of deleting", async () => {
    const res = await post("/api/bookings/checkout", { date: futureDate(8), startTime: "11:00", method: "venue" }, tokenFor(REG));
    const id = res.body.data.booking.id;
    const cancel = await api().patch(`/api/bookings/${id}`).set(bearer(adminToken())).send({ status: "cancelled", sendSms: false });
    expect(cancel.status).toBe(200);
    const row = await prisma.booking.findUnique({ where: { id } });
    expect(row?.status).toBe("cancelled");
    expect(row?.cancelledAt).not.toBeNull();
    expect(await prisma.bookingSlot.count({ where: { bookingId: id } })).toBe(0);
  });
});
