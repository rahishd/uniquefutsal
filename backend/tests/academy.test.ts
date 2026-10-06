import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { addDaysKey, todayKey } from "../src/utils/dates";

const A = "9800000801";
const B = "9800000802";
const D = (n: number) => addDaysKey(todayKey(), n);
const ids: string[] = [];

const form = (sessionId: string, over: object = {}) => ({
  guardianName: "Guardian A", guardianPhone: "9841000001", emergencyPhone: "9841000002", address: "Baneshwor, Kathmandu",
  childName: "Aarav", childAge: 12, healthStatus: "healthy", sessionId, acceptTerms: true, termsVersion: 1, ...over,
});
const enroll = (phone: string, body: object) => api().post("/api/academy/enroll").set(bearer(tokenFor(phone))).send(body);
async function mk(over: Record<string, unknown> = {}) {
  const s = await prisma.academySession.create({ data: { date: D(2), startTime: "07:00", endTime: "08:30", capacity: 2, createdBy: "t", ...over } as never });
  ids.push(s.id);
  return s;
}
async function wipe() {
  await prisma.academySession.deleteMany({ where: { createdBy: "t" } });
  await prisma.settings.deleteMany({ where: { key: "academyTerms" } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}
beforeAll(async () => { await wipe(); await makeUser(A, "Guardian A"); await makeUser(B, "Guardian B"); });
afterAll(wipe);

describe("academy", () => {
  it("shows only visible, open, future classes and the terms, without signing in", async () => {
    const shown = await mk();
    const hidden = await mk({ visible: false });
    const gone = await mk({ status: "cancelled" });
    const r = await api().get("/api/academy/info");
    expect(r.status).toBe(200);
    const list = r.body.data.sessions.map((s: { id: string }) => s.id);
    expect(list).toContain(shown.id);
    expect(list).not.toContain(hidden.id);
    expect(list).not.toContain(gone.id);
    expect(r.body.data.minAge).toBe(10);
    expect(r.body.data.terms.version).toBe(1);
  });

  it("needs sign-in and validates the form", async () => {
    const s = await mk();
    expect((await api().post("/api/academy/enroll").send(form(s.id))).status).toBe(401);
    for (const bad of [
      { childAge: 9 }, { childAge: 15 }, { guardianPhone: "123" }, { emergencyPhone: "9841000001" },
      { healthStatus: "condition" }, { healthStatus: "sick" }, { acceptTerms: false }, { childName: "" }, { address: "x" },
    ]) expect((await enroll(A, form(s.id, bad))).status).toBe(400);
    expect((await enroll(A, form("", {}))).status).toBe(400);
  });

  it("confirms with a code, rejects duplicates, and frees the seat on cancel", async () => {
    const s = await mk();
    const r = await enroll(A, form(s.id, { healthStatus: "condition", healthNotes: "Asthma, has an inhaler" }));
    expect(r.status).toBe(201);
    expect(r.body.data.code).toMatch(/^AC-[A-Z2-9]{6}$/);
    expect((await enroll(A, form(s.id))).status).toBe(409);
    const mine = await api().get("/api/academy/mine").set(bearer(tokenFor(A)));
    expect(mine.body.data.some((e: { id: string }) => e.id === r.body.data.id)).toBe(true);
    expect((await api().get("/api/academy/mine").set(bearer(tokenFor(B)))).body.data).toHaveLength(0);
    expect((await api().post(`/api/academy/enrollments/${r.body.data.id}/cancel`).set(bearer(tokenFor(B)))).status).toBe(404);
    expect((await api().post(`/api/academy/enrollments/${r.body.data.id}/cancel`).set(bearer(tokenFor(A)))).status).toBe(200);
    expect((await api().post(`/api/academy/enrollments/${r.body.data.id}/cancel`).set(bearer(tokenFor(A)))).status).toBe(409);
    const again = await enroll(A, form(s.id)); // re-enrol after cancelling
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(r.body.data.id);
  });

  it("never lets a full class go over capacity, even at the same moment", async () => {
    const s = await mk({ capacity: 1 });
    const res = await Promise.all([enroll(A, form(s.id, { childName: "One" })), enroll(B, form(s.id, { childName: "Two" }))]);
    expect(res.map((x) => x.status).sort()).toEqual([201, 409]);
    expect(await prisma.academyEnrollment.count({ where: { sessionId: s.id, status: "confirmed" } })).toBe(1);
  });

  it("refuses started, hidden and old-terms enrolments", async () => {
    const past = await mk({ date: D(-1) });
    expect((await enroll(A, form(past.id, { childName: "Late" }))).status).toBe(409);
    const hidden = await mk({ visible: false });
    expect((await enroll(A, form(hidden.id, { childName: "Hid" }))).status).toBe(404);
    const s = await mk();
    await prisma.settings.upsert({ where: { key: "academyTerms" }, update: { value: JSON.stringify({ version: 2, text: "New rules", updatedAt: null }) }, create: { key: "academyTerms", value: JSON.stringify({ version: 2, text: "New rules", updatedAt: null }) } });
    expect((await enroll(A, form(s.id, { childName: "Old" }))).status).toBe(409);
    expect((await enroll(A, form(s.id, { childName: "Old", termsVersion: 2 }))).status).toBe(201);
  });

  it("limits enrolments per guardian per day", async () => {
    const s = await mk({ capacity: 20, date: D(3) });
    await prisma.settings.deleteMany({ where: { key: "academyTerms" } });
    await prisma.academyEnrollment.deleteMany({ where: { userId: B } });
    const names = ["Ka", "Kb", "Kc", "Kd", "Ke", "Kf"];
    const codes: number[] = [];
    for (const n of names) codes.push((await enroll(B, form(s.id, { childName: n }))).status);
    expect(codes.filter((c) => c === 201).length).toBe(5);
    expect(codes[5]).toBe(429);
  });
});
