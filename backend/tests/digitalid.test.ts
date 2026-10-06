import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800001101";
const B = "9800001102";
beforeAll(async () => { await prisma.digitalId.deleteMany({ where: { userId: { in: [A, B] } } }); await makeUser(A, "Digital A"); await makeUser(B, "Digital B"); });
afterAll(async () => { await prisma.digitalId.deleteMany({ where: { userId: { in: [A, B] } } }); await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } }); });

describe("customer Digital ID", () => {
  it("needs sign-in", async () => {
    expect((await api().get("/api/me/digital-id")).status).toBe(401);
  });

  it("gives a stable random QR value with no personal data in it", async () => {
    const r1 = await api().get("/api/me/digital-id").set(bearer(tokenFor(A)));
    expect(r1.status).toBe(200);
    expect(r1.body.data).toMatchObject({ name: "Digital A", phone: A });
    const payload: string = r1.body.data.payload;
    expect(payload).toMatch(/^UFID1\.[A-Za-z0-9_-]{32}$/);
    expect(payload).not.toContain(A);
    expect(payload.toLowerCase()).not.toContain("digital");
    const r2 = await api().get("/api/me/digital-id").set(bearer(tokenFor(A)));
    expect(r2.body.data.payload).toBe(payload); // same card every time
  });

  it("every customer has a different value", async () => {
    const a = await api().get("/api/me/digital-id").set(bearer(tokenFor(A)));
    const b = await api().get("/api/me/digital-id").set(bearer(tokenFor(B)));
    expect(a.body.data.payload).not.toBe(b.body.data.payload);
  });

  it("replacing makes a new value and the old one is gone", async () => {
    const before = (await api().get("/api/me/digital-id").set(bearer(tokenFor(A)))).body.data.payload;
    const r = await api().post("/api/me/digital-id/replace").set(bearer(tokenFor(A)));
    expect(r.status).toBe(200);
    expect(r.body.data.payload).not.toBe(before);
    expect(r.body.data.replacedAt).toBeTruthy();
    expect(await prisma.digitalId.count({ where: { token: before.replace("UFID1.", "") } })).toBe(0);
  });

  it("staff accounts have no customer card", async () => {
    expect((await api().get("/api/me/digital-id").set(bearer(tokenFor("admin-test", "superadmin")))).status).toBe(403);
  });
});
