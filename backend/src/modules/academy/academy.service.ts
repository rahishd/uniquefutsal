import { randomInt } from "crypto";
import { AcademyEnrollment, AcademySession, Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { currentTime, todayKey } from "../../utils/dates";

// Children's Academy: ages 10 to 14. Staff publish class times (admin portal); a guardian enrols a child.
// The server decides everything: the age range, who is full, which terms version was accepted, and whether a class has started.
export const MIN_AGE = 10;
export const MAX_AGE = 14;
export const PER_DAY = 5; // enrolments one guardian can make in 24 hours (anti-spam)

export const TERMS_KEY = "academyTerms";

// Shown until staff write their own in the admin portal (Children's Academy > Terms). They are a starting point, not legal advice.
export const DEFAULT_TERMS = [
  "1. The Children's Academy is for children aged 10 to 14 on the day of the class.",
  "2. The details you give (your contact numbers, the emergency contact and your address) must be correct. We will call the emergency contact if we cannot reach you.",
  "3. Tell us honestly about any health condition or allergy. If your child is unwell on the day, please keep them at home.",
  "4. Please bring sports shoes and a bottle of water, and arrive 10 minutes early.",
  "5. You can cancel a class in the app before it starts. If we have to cancel a class we will tell you in the app.",
  "6. Any fees are agreed and paid at the venue.",
].join("\n");

export interface Terms { version: number; text: string; updatedAt: string | null }

export async function getTerms(): Promise<Terms> {
  const row = await prisma.settings.findUnique({ where: { key: TERMS_KEY } });
  if (row) {
    try {
      const j = JSON.parse(row.value) as Terms;
      if (j && typeof j.text === "string" && Number.isInteger(j.version)) return { version: j.version, text: j.text, updatedAt: j.updatedAt ?? null };
    } catch { /* fall through to the default */ }
  }
  return { version: 1, text: DEFAULT_TERMS, updatedAt: null };
}

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const makeCode = () => "AC-" + Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const PHONE = /^9\d{9}$/;
const clean = (v: unknown, min: number, max: number, what: string) => {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (s.length < min) throw new AppError(400, `Please enter ${what}.`);
  if (s.length > max) throw new AppError(400, `${what[0].toUpperCase()}${what.slice(1)} is too long.`);
  return s;
};

// A class has started once its date is past, or it is today and the start time has passed.
export const hasStarted = (s: Pick<AcademySession, "date" | "startTime">) => {
  const today = todayKey();
  return s.date < today || (s.date === today && s.startTime <= currentTime());
};

type SessionWithCount = AcademySession & { _taken: number };

async function withTaken(list: AcademySession[]): Promise<SessionWithCount[]> {
  if (list.length === 0) return [];
  const counts = await prisma.academyEnrollment.groupBy({ by: ["sessionId"], where: { sessionId: { in: list.map((s) => s.id) }, status: { not: "cancelled" } }, _count: { _all: true } });
  const m = new Map(counts.map((c) => [c.sessionId, c._count._all]));
  return list.map((s) => ({ ...s, _taken: m.get(s.id) ?? 0 }));
}

export const sessionView = (s: SessionWithCount) => ({
  id: s.id, title: s.title, date: s.date, startTime: s.startTime, endTime: s.endTime, coach: s.coach,
  capacity: s.capacity, seatsLeft: Math.max(0, s.capacity - s._taken),
});

export function enrollmentView(e: AcademyEnrollment & { session: AcademySession }) {
  return {
    id: e.id, code: e.code, status: e.status, childName: e.childName, childAge: e.childAge, healthStatus: e.healthStatus, healthNotes: e.healthNotes,
    guardianName: e.guardianName, guardianPhone: e.guardianPhone, emergencyPhone: e.emergencyPhone, address: e.address,
    termsVersion: e.termsVersion, createdAt: e.createdAt, cancelledAt: e.cancelledAt, cancelledBy: e.cancelledBy,
    session: { id: e.session.id, title: e.session.title, date: e.session.date, startTime: e.session.startTime, endTime: e.session.endTime, coach: e.session.coach, status: e.session.status },
    canCancel: e.status === "confirmed" && e.session.status === "open" && !hasStarted(e.session),
  };
}

export class AcademyService {
  // What the page needs: the rules, the current terms, and the classes staff made visible that can still be joined.
  async info() {
    const today = todayKey();
    const rows = await prisma.academySession.findMany({ where: { visible: true, status: "open", date: { gte: today } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 60 });
    const open = (await withTaken(rows.filter((s) => !hasStarted(s)))).map(sessionView);
    return { minAge: MIN_AGE, maxAge: MAX_AGE, perDay: PER_DAY, terms: await getTerms(), sessions: open };
  }

  async enroll(userId: string, input: Record<string, unknown>) {
    const guardianName = clean(input.guardianName, 2, 60, "the guardian's name");
    const guardianPhone = typeof input.guardianPhone === "string" ? input.guardianPhone.trim() : "";
    const emergencyPhone = typeof input.emergencyPhone === "string" ? input.emergencyPhone.trim() : "";
    if (!PHONE.test(guardianPhone)) throw new AppError(400, "Enter the guardian's 10-digit mobile number, starting with 9.");
    if (!PHONE.test(emergencyPhone)) throw new AppError(400, "Enter the emergency contact's 10-digit mobile number, starting with 9.");
    if (emergencyPhone === guardianPhone) throw new AppError(400, "The emergency contact must be a different number from the guardian's.");
    const address = clean(input.address, 5, 200, "your address");
    const childName = clean(input.childName, 2, 60, "the child's name");
    const childAge = Number(input.childAge);
    if (!Number.isInteger(childAge) || childAge < MIN_AGE || childAge > MAX_AGE) throw new AppError(400, `The academy is for children aged ${MIN_AGE} to ${MAX_AGE}.`);
    const healthStatus = input.healthStatus;
    if (healthStatus !== "healthy" && healthStatus !== "condition") throw new AppError(400, "Please tell us about the child's health.");
    let healthNotes: string | null = null;
    if (healthStatus === "condition") healthNotes = clean(input.healthNotes, 3, 500, "details of the health condition or allergy");
    else if (typeof input.healthNotes === "string" && input.healthNotes.trim()) healthNotes = clean(input.healthNotes, 1, 500, "health notes");

    const terms = await getTerms();
    if (input.acceptTerms !== true) throw new AppError(400, "Please accept the Terms and Conditions to confirm.");
    if (Number(input.termsVersion) !== terms.version) throw new AppError(409, "The Terms and Conditions were just updated. Please read them again and accept to confirm.");

    const sessionId = typeof input.sessionId === "string" ? input.sessionId : "";
    if (!sessionId) throw new AppError(400, "Choose a class time.");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await prisma.academyEnrollment.count({ where: { userId, createdAt: { gte: since } } })) >= PER_DAY) {
      throw new AppError(429, `You can enrol up to ${PER_DAY} times a day. Please try again tomorrow, or call the venue.`);
    }

    const childKey = childName.toLowerCase();
    const row = await prisma.$transaction(async (tx) => {
      // Lock this class so two guardians cannot take the last seat at the same moment.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "AcademySession" WHERE id = ${sessionId} FOR UPDATE`);
      const session = await tx.academySession.findUnique({ where: { id: sessionId } });
      if (!session || !session.visible || session.status !== "open") throw new AppError(404, "That class is not available.");
      if (hasStarted(session)) throw new AppError(409, "That class has already started. Please choose another time.");
      const taken = await tx.academyEnrollment.count({ where: { sessionId, status: { not: "cancelled" } } });
      if (taken >= session.capacity) throw new AppError(409, "That class is full. Please choose another time.");

      const data = {
        guardianName, guardianPhone, emergencyPhone, address, childName, childKey, childAge, healthStatus, healthNotes,
        termsVersion: terms.version, termsAcceptedAt: new Date(), status: "confirmed", cancelledAt: null, cancelledBy: null,
      };
      const existing = await tx.academyEnrollment.findUnique({ where: { sessionId_userId_childKey: { sessionId, userId, childKey } } });
      if (existing && existing.status !== "cancelled") throw new AppError(409, `${childName} is already enrolled in this class.`);
      if (existing) return tx.academyEnrollment.update({ where: { id: existing.id }, data, include: { session: true } }); // came back after cancelling
      let code = makeCode();
      for (let i = 0; i < 5 && (await tx.academyEnrollment.findUnique({ where: { code }, select: { id: true } })); i++) code = makeCode();
      return tx.academyEnrollment.create({ data: { ...data, code, sessionId, userId }, include: { session: true } });
    });
    return enrollmentView(row);
  }

  async mine(userId: string) {
    const rows = await prisma.academyEnrollment.findMany({ where: { userId }, include: { session: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map(enrollmentView);
  }

  async cancel(userId: string, id: string) {
    const e = await prisma.academyEnrollment.findUnique({ where: { id }, include: { session: true } });
    if (!e || e.userId !== userId) throw new AppError(404, "Enrolment not found");
    if (e.status === "cancelled") throw new AppError(409, "This enrolment is already cancelled.");
    if (e.status !== "confirmed") throw new AppError(409, "This class has already been marked.");
    if (hasStarted(e.session)) throw new AppError(409, "The class has already started, so it can no longer be cancelled here. Please call the venue.");
    const upd = await prisma.academyEnrollment.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date(), cancelledBy: "guardian" }, include: { session: true } });
    return enrollmentView(upd);
  }
}

export default new AcademyService();
