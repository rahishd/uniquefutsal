// Gives every older booking its short display code. Safe to run again: only rows without a code are touched.
// Uses whatever DATABASE_URL is in .env (the local-database guard in src/config/env.ts still applies).
import { prisma } from "../src/config/db";
import { uniqueBookingCode } from "../src/utils/bookingCode";

(async () => {
  const rows = await prisma.booking.findMany({ where: { code: null }, select: { id: true } });
  for (const r of rows) await prisma.booking.update({ where: { id: r.id }, data: { code: await uniqueBookingCode() } });
  console.log(`Backfilled ${rows.length} booking code(s).`);
  await prisma.$disconnect();
})();
