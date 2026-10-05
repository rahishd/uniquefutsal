import request from "supertest";
import app from "../src/app";
import prisma from "../src/config/db";
import { JwtUtil } from "../src/utils/jwt";
import { HashUtil } from "../src/utils/hash";

export { app, prisma };
export const api = () => request(app);

export const tokenFor = (phone: string, role = "user") => JwtUtil.sign({ id: phone, role, email: null });
export const adminToken = () => tokenFor("admin-test", "superadmin");
export const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

export function futureDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function makeUser(phone: string, name: string, extra: Record<string, unknown> = {}) {
  return prisma.user.upsert({
    where: { phoneNumber: phone },
    update: { name, ...extra },
    create: { phoneNumber: phone, name, password: await HashUtil.hash("Test#1234"), isVerified: true, role: "user", ...extra },
  });
}

export async function wipeTestData(phones: string[]) {
  const ids = (await prisma.booking.findMany({ where: { OR: [{ customerPhone: { in: phones } }, { userId: { in: phones } }] }, select: { id: true } })).map((b) => b.id);
  await prisma.bookingSlot.deleteMany({ where: { bookingId: { in: ids } } });
  await prisma.paymentOrder.deleteMany({ where: { orderCode: { in: ids } } });
  await prisma.booking.deleteMany({ where: { OR: [{ customerPhone: { in: phones } }, { userId: { in: phones } }] } });
  await prisma.notification.deleteMany({ where: { userId: { in: phones } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: phones } } });
}
