import { futureDate, makeUser, prisma } from "./helpers";
import { backfillBookingSlots, importLegacyLoyalty } from "../src/services/legacyBridge";

const P = "98000008";
const A = `${P}01`;
const B = `${P}02`;

async function wipe() {
  const ids = (await prisma.booking.findMany({ where: { OR: [{ userId: { in: [A, B] } }, { customerPhone: { in: [A, B] } }] }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.freeGameVoucher.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.loyaltyEntry.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.settings.deleteMany({ where: { key: { startsWith: `legacy-free-matches:${P}` } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}

const legacyBooking = (userId: string, date: string, startTime: string, duration = 1) =>
  prisma.booking.create({ data: { userId, date, startTime, endTime: `${String(parseInt(startTime) + duration).padStart(2, "0")}:00`, duration, customerName: "Old", customerPhone: userId, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed" } as any });

const counts = async () => ({ users: await prisma.user.count(), bookings: await prisma.booking.count(), subs: await prisma.membershipSubscription.count() });

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Old Customer A", { freeMatchesAvailable: 2, loyaltyProgress: 6 });
  await makeUser(B, "Old Customer B", { freeMatchesAvailable: 0, loyaltyProgress: 3 });
});
afterAll(async () => {
  await wipe();
  await prisma.$disconnect();
});

describe("booking slot backfill", () => {
  it("dry run reports; apply creates rows; running again changes nothing; existing rows are untouched", async () => {
    const date = futureDate(4);
    const b1 = await legacyBooking(A, date, "16:00", 2); // 16 and 17
    await legacyBooking(B, date, "17:00"); // overlaps hour 17 of the first: reported, not changed
    const before = await counts();

    const dry = await backfillBookingSlots({ apply: false });
    expect(dry.dryRun).toBe(true);
    expect(dry.created).toBe(0);
    expect(await prisma.bookingSlot.count({ where: { bookingId: b1.id } })).toBe(0);

    const run = await backfillBookingSlots({ apply: true });
    expect(run.created).toBeGreaterThanOrEqual(2);
    expect((run.overlaps as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(await prisma.bookingSlot.count({ where: { bookingId: b1.id } })).toBe(2);

    const again = await backfillBookingSlots({ apply: true });
    expect(again.created).toBe(0);
    expect(await counts()).toEqual(before); // no customer record was added or removed
  });
});

describe("legacy loyalty import", () => {
  it("dry run changes nothing and explains what it would do", async () => {
    const r = await importLegacyLoyalty({ apply: false });
    expect(r.dryRun).toBe(true);
    expect(r.openingPoints).toBeGreaterThan(0);
    expect(r.freeMatchesNotConverted).toBeGreaterThanOrEqual(2);
    expect(await prisma.loyaltyEntry.count({ where: { userId: { in: [A, B] } } })).toBe(0);
    expect(await prisma.freeGameVoucher.count({ where: { userId: { in: [A, B] } } })).toBe(0);
  });

  it("applies once: opening points and vouchers; the old fields are left exactly as they were", async () => {
    const run1 = await importLegacyLoyalty({ apply: true, voucherPeriod: "Day" });
    expect(run1.dryRun).toBe(false);
    const aPts = (await prisma.loyaltyEntry.findMany({ where: { userId: A } })).reduce((n, e) => n + Number(e.points), 0);
    const bPts = (await prisma.loyaltyEntry.findMany({ where: { userId: B } })).reduce((n, e) => n + Number(e.points), 0);
    expect(aPts).toBe(60); // 6 old hours x 10 points (a Day game is Rs. 1,000 = 10 points)
    expect(bPts).toBe(30);
    expect(await prisma.freeGameVoucher.count({ where: { userId: A, period: "Day" } })).toBe(2);

    await importLegacyLoyalty({ apply: true, voucherPeriod: "Day" }); // again
    expect(await prisma.freeGameVoucher.count({ where: { userId: A } })).toBe(2);
    expect(await prisma.loyaltyEntry.count({ where: { userId: A } })).toBe(1);

    const oldA = await prisma.user.findUnique({ where: { phoneNumber: A } });
    expect(oldA?.freeMatchesAvailable).toBe(2);
    expect(oldA?.loyaltyProgress).toBe(6);
  });
});
