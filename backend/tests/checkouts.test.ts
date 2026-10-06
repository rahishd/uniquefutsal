import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800001001";
const mkBooking = (code: string, over: object = {}) =>
  prisma.booking.create({ data: { userId: A, date: "2026-10-05", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "x", basePrice: 1250, subtotal: 1250, totalPrice: 1250, paymentMethod: "venue", status: "completed", paymentStatus: "completed", code, ...over } });

async function wipe() {
  await prisma.checkout.deleteMany({ where: { userId: A } });
  await prisma.booking.deleteMany({ where: { userId: A } });
  await prisma.user.deleteMany({ where: { phoneNumber: A } });
}
beforeAll(async () => { await wipe(); await makeUser(A, "Bill Payer"); });
afterAll(wipe);

describe("payment history shows final bills", () => {
  it("lists a bill with its game and goods lines and points, and does not repeat the game it contains", async () => {
    const inBill = await mkBooking("UF-CHK001");
    const alone = await mkBooking("UF-CHK002", { date: "2026-10-04", totalPrice: 900 });
    await prisma.checkout.create({
      data: {
        code: "CB-TEST01", userId: A, paymentMethod: "cash", goodsTotal: 100, gameTotal: 1250, total: 1350, bookingIds: [inBill.id], createdBy: "staff",
        lines: JSON.stringify([{ type: "game", label: "Game 18:00-19:00", quantity: 1, amount: 1250 }, { type: "goods", label: "Mineral water", quantity: 4, amount: 100 }]),
        pointsGoods: 1, pointsGames: 12.5,
      },
    });
    const r = await api().get("/api/me/payments").set(bearer(tokenFor(A)));
    expect(r.status).toBe(200);
    const items = r.body.data as { code: string; kind: string; amount: number; points?: number; lines?: { type: string }[] }[];
    const bill = items.find((i) => i.kind === "bill")!;
    expect(bill).toMatchObject({ code: "CB-TEST01", amount: 1350, points: 13.5 });
    expect(bill.lines!.map((l) => l.type)).toEqual(["game", "goods"]);
    expect(items.map((i) => i.code)).toContain(alone.code);
    expect(items.map((i) => i.code)).not.toContain("UF-CHK001");
  });

  it("another customer never sees it", async () => {
    await makeUser("9800001002", "Other");
    const r = await api().get("/api/me/payments").set(bearer(tokenFor("9800001002")));
    expect(r.body.data).toEqual([]);
    await prisma.user.deleteMany({ where: { phoneNumber: "9800001002" } });
  });
});
