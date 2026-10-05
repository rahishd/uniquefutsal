/**
 * Fills the LOCAL development database with fake demo content so the customer app has something to show:
 * promo codes, a live tournament with a tie-sheet, a few sample customers. Refuses to run on any non-local database.
 *   npx tsx scripts/seed-dev.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSafeDatabaseUrl } from "../src/config/env";

assertSafeDatabaseUrl(process.env.DATABASE_URL ?? "", "development");
const prisma = new PrismaClient();

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const plus = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
};

async function main() {
  const promoCodes = [
    { code: "DASHAIN83", type: "percent", value: 15, label: "15% off", title: "Dashain Special", description: "Any game, any shift", expiryDate: plus(12), appliedTo: "booking", isActive: true },
    { code: "WEEKEND10", type: "percent", value: 10, label: "10% off", title: "Weekend Warriors", description: "Saturday and Sunday games", expiryDate: plus(25), validDays: ["Saturday", "Sunday"], appliedTo: "booking", isActive: true },
    { code: "EARLY200", type: "flat", value: 200, label: "Rs. 200 off", title: "Morning Kickoff", description: "Slots before 8 AM", expiryDate: plus(55), startTime: "05:00", endTime: "08:00", appliedTo: "booking", isActive: true },
    { code: "MONSOON15", type: "percent", value: 15, label: "15% off", title: "Monsoon Match", description: "Weekday day games", expiryDate: plus(-20), appliedTo: "booking", isActive: true },
  ];
  await prisma.settings.upsert({ where: { key: "promoCodes" }, update: { value: JSON.stringify(promoCodes) }, create: { key: "promoCodes", value: JSON.stringify(promoCodes) } });

  const t = await prisma.tournament.upsert({
    where: { id: "dev-cup" },
    update: { startDate: plus(-2), endDate: plus(5) },
    create: {
      id: "dev-cup", name: "Unique Futsal Cup 2083", prizePool: 50000, minTeams: 4, maxTeams: 8, startDate: plus(-2), endDate: plus(5),
      description: JSON.stringify({ prizes: { first: "Rs. 25,000", second: "Rs. 15,000", third: "Rs. 10,000" }, format: "8 teams, knockout" }),
    },
  });
  await prisma.tournamentRound.deleteMany({ where: { tournamentId: t.id } });
  await prisma.tournamentRound.create({
    data: {
      tournamentId: t.id, name: "Quarter-finals", position: 0,
      matches: {
        create: [
          { home: "Red Devils", away: "Iron Wolves", status: "finished", homeScore: 4, awayScore: 2 },
          { home: "Blue Eagles", away: "Neon Kings", status: "finished", homeScore: 3, awayScore: 1 },
          { home: "Storm FC", away: "Viper FC", status: "live", homeScore: 1, awayScore: 1, note: "34'" },
          { home: "Galaxy United", away: "Titan Squad", status: "upcoming" },
        ],
      },
    },
  });
  await prisma.tournamentRound.create({ data: { tournamentId: t.id, name: "Semi-finals", position: 1, matches: { create: [{ home: "Red Devils", away: "Blue Eagles" }, { home: null, away: null }] } } });
  await prisma.tournamentRound.create({ data: { tournamentId: t.id, name: "Final", position: 2, matches: { create: [{ home: null, away: null }] } } });

  // fake customers (password "demo1234")
  const hash = await bcrypt.hash("demo1234", 10);
  const people: [string, string][] = [["9811000001", "Aayush Ghimire"], ["9811000002", "Bibek Sapkota"], ["9811000003", "Chirag Neupane"], ["9811000004", "Dinesh Subedi"], ["9811000005", "Elish Maharjan"], ["9811000006", "Fanindra Baral"]];
  for (const [phone, name] of people) {
    await prisma.user.upsert({ where: { phoneNumber: phone }, update: {}, create: { phoneNumber: phone, name, password: hash, isVerified: true, role: "user" } });
  }
  // fake membership plans (prices are made up)
  if ((await prisma.membershipPlan.count({ where: { name: { in: ["Basic", "Premium"] } } })) === 0) {
    await prisma.membershipPlan.create({ data: { name: "Basic", description: "One fixed hour, every day you choose", price: 6000, perks: JSON.stringify(["Member price on your hour", "Priority booking"]), price1MonthMorning: 6000, price1MonthDay: 7000, price1MonthEvening: 8000, price3MonthsMorning: 16500, price3MonthsDay: 19000, price3MonthsEvening: 22000, discount3MonthsMorning: 500 } });
    await prisma.membershipPlan.create({ data: { name: "Premium", description: "Basic plus extra perks", featured: true, price: 9000, perks: JSON.stringify(["Everything in Basic", "Free bottled water", "Bonus loyalty points"]), price1MonthMorning: 9000, price1MonthDay: 10000, price1MonthEvening: 11000, price3MonthsMorning: 25000, price3MonthsDay: 28000, price3MonthsEvening: 31000 } });
  }
  console.log("Dev data ready: 4 promo codes, 1 live tournament with a tie-sheet, 6 demo players (password demo1234).");
}

main().finally(() => prisma.$disconnect());
