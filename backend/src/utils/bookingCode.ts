import { randomInt } from "crypto";
import { prisma } from "../config/db";

// Short code the customer sees and quotes ("UF-7K3QX9"). The long internal id stays the real key.
// No 0/O/1/I so it is easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export const makeBookingCode = () => "UF-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function uniqueBookingCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = makeBookingCode();
    if (!(await prisma.booking.findFirst({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("Could not make a unique booking code");
}

// What to show when an older booking has no stored code yet.
export const fallbackBookingCode = (id: string) => "UF-" + id.slice(-6).toUpperCase();
