import { api, adminToken, bearer, makeUser, prisma } from "./helpers";
import loyaltyService from "../src/modules/loyalty/loyalty.service";

const P = "98000007";
const OLD = `${P}01`;
const NEW = `${P}02`;
const CAPT = `${P}03`;
const PLAYER = `${P}04`;

async function wipe() {
  const phones = [OLD, NEW, CAPT, PLAYER];
  await prisma.teamMember.deleteMany({ where: { userId: { in: phones } } });
  await prisma.team.deleteMany({ where: { captainId: { in: phones } } });
  for (const t of ["loyaltyEntry", "freeGameVoucher", "userPrefs", "pushSubscription", "arrivalCheckin"] as const) {
    await (prisma[t] as any).deleteMany({ where: { userId: { in: phones } } });
  }
  await prisma.gzBooking.deleteMany({ where: { OR: [{ userId: { in: phones } }, { guestName: "Deleted Player", consoleId: "test-console" }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: phones } } });
  await prisma.booking.deleteMany({ where: { OR: [{ userId: { in: phones } }, { customerPhone: { in: phones } }, { customerName: "Deleted Player", basePrice: 777 }] } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: phones } } });
}

beforeAll(async () => {
  await wipe();
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

const staff = () => bearer(adminToken());

describe("staff change a customer's phone number", () => {
  it("moves points, vouchers, preferences, team seat and sessions with it", async () => {
    await makeUser(OLD, "Mover");
    await loyaltyService.award({ userId: OLD, kind: "goods", points: 40, sourceType: "test", sourceId: "mv1", detail: "Test goods" });
    await prisma.freeGameVoucher.create({ data: { userId: OLD, period: "Day", cost: 100 } });
    await prisma.userPrefs.create({ data: { userId: OLD, location: "Butwal", mode: "captain" } });
    await prisma.gzBooking.create({ data: { code: "UF-GZ-TEST-MOVE1", userId: OLD, consoleId: "test-console", gameTitle: "GTA 5", date: "2026-09-01", startHour: 12, hours: 1, players: 1, total: 300, paymentMethod: "venue" } });
    const team = await prisma.team.create({ data: { name: "Mover FC Test", captainId: OLD, members: { create: { userId: OLD } } } });

    const res = await api().patch(`/api/users/${OLD}`).set(staff()).send({ phoneNumber: NEW });
    expect(res.status).toBe(200);

    expect(await prisma.user.findUnique({ where: { phoneNumber: OLD } })).toBeNull();
    expect(await prisma.loyaltyEntry.count({ where: { userId: NEW } })).toBe(1);
    expect(await prisma.loyaltyEntry.count({ where: { userId: OLD } })).toBe(0);
    expect(await prisma.freeGameVoucher.count({ where: { userId: NEW } })).toBe(1);
    expect((await prisma.userPrefs.findUnique({ where: { userId: NEW } }))?.location).toBe("Butwal");
    expect((await prisma.gzBooking.findUnique({ where: { code: "UF-GZ-TEST-MOVE1" } }))?.userId).toBe(NEW);
    expect((await prisma.team.findUnique({ where: { id: team.id } }))?.captainId).toBe(NEW);
    expect(await prisma.teamMember.count({ where: { userId: NEW } })).toBe(1);
    const o = await loyaltyService.overview(NEW);
    expect(o.remaining).toBe(40);
    await prisma.team.delete({ where: { id: team.id } });
  });
});

describe("staff delete a customer", () => {
  it("refuses while the player captains a team", async () => {
    await makeUser(CAPT, "Captain Delete");
    await prisma.team.create({ data: { name: "Keep Me FC Test", captainId: CAPT, members: { create: { userId: CAPT } } } });
    const res = await api().delete(`/api/users/${CAPT}`).set(staff());
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.findUnique({ where: { phoneNumber: CAPT } })).not.toBeNull();
  });

  it("removes personal customer-app data but keeps the money records (anonymised)", async () => {
    await makeUser(PLAYER, "Leaving Player");
    await loyaltyService.award({ userId: PLAYER, kind: "goods", points: 10, sourceType: "test", sourceId: "del1", detail: "Test goods" });
    await prisma.userPrefs.create({ data: { userId: PLAYER } });
    await prisma.gzBooking.create({ data: { code: "UF-GZ-TEST-DEL01", userId: PLAYER, consoleId: "test-console", gameTitle: "GTA 5", date: "2026-09-01", startHour: 12, hours: 1, players: 1, total: 300, paymentMethod: "venue", paymentStatus: "paid" } });
    await prisma.booking.create({ data: { userId: PLAYER, date: "2026-09-01", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "Leaving Player", customerPhone: PLAYER, basePrice: 777, subtotal: 777, totalPrice: 777, paymentMethod: "venue", paymentStatus: "completed", status: "completed" } as any });

    const res = await api().delete(`/api/users/${PLAYER}`).set(staff());
    expect(res.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { phoneNumber: PLAYER } })).toBeNull();
    expect(await prisma.loyaltyEntry.count({ where: { userId: PLAYER } })).toBe(0);
    expect(await prisma.userPrefs.count({ where: { userId: PLAYER } })).toBe(0);
    const gz = await prisma.gzBooking.findUnique({ where: { code: "UF-GZ-TEST-DEL01" } });
    expect(gz?.total).toBe(300); // the money record stays
    expect(gz?.userId).toBeNull();
    expect(gz?.guestName).toBe("Deleted Player");
    const b = await prisma.booking.findFirst({ where: { basePrice: 777, customerName: "Deleted Player" } });
    expect(b?.totalPrice).toBe(777);
    expect(b?.customerPhone).toBeNull();
  });
});
