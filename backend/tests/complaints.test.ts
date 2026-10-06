import fs from "fs";
import path from "path";
import sharp from "sharp";
import { api, adminToken, bearer, makeUser, prisma, tokenFor } from "./helpers";

const A = "9800000701";
const B = "9800000702";
const ADMIN_ID = "admin-test";
const files: string[] = [];

const png = async () => `data:image/png;base64,${(await sharp({ create: { width: 40, height: 30, channels: 3, background: "#cc2222" } }).png().toBuffer()).toString("base64")}`;
const good = { category: "facilities", message: "The floodlight above the left goal was flickering all evening." };
const send = (phone: string, body: object) => api().post("/api/complaints").set(bearer(tokenFor(phone))).send(body);

async function wipe() {
  await prisma.complaint.deleteMany({ where: { userId: { in: [A, B] } } });
  const ids = (await prisma.booking.findMany({ where: { userId: { in: [A, B] } }, select: { id: true } })).map((b) => b.id);
  await prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await prisma.notification.deleteMany({ where: { userId: { in: [A, B] } } });
  await prisma.user.deleteMany({ where: { phoneNumber: { in: [A, B] } } });
}

beforeAll(async () => {
  await wipe();
  await makeUser(A, "Complainer A");
  await makeUser(B, "Complainer B");
});
afterAll(async () => {
  for (const f of files) fs.rmSync(f, { force: true });
  await wipe();
});

describe("complaints: submitting", () => {
  it("lists the categories without signing in", async () => {
    const r = await api().get("/api/complaints/categories");
    expect(r.status).toBe(200);
    expect(r.body.data.categories.map((c: { id: string }) => c.id)).toEqual(expect.arrayContaining(["booking", "payment", "staff", "other"]));
    expect(r.body.data.maxPhotos).toBe(3);
  });

  it("needs a signed-in customer", async () => {
    expect((await api().post("/api/complaints").send(good)).status).toBe(401);
    expect((await api().get("/api/complaints/me")).status).toBe(401);
  });

  it("checks the category and the message", async () => {
    expect((await send(A, { ...good, category: "nonsense" })).status).toBe(400);
    expect((await send(A, { ...good, message: "too short" })).status).toBe(400);
    expect((await send(A, { ...good, message: "x".repeat(1501) })).status).toBe(400);
    expect((await send(A, { message: good.message })).status).toBe(400);
  });

  it("saves a complaint with a short code and shows it only to its owner", async () => {
    const r = await send(A, good);
    expect(r.status).toBe(201);
    expect(r.body.data.code).toMatch(/^CP-[A-Z2-9]{6}$/);
    expect(r.body.data.status).toBe("open");
    expect(r.body.data.categoryLabel).toBe("Court or facilities");
    const mineA = await api().get("/api/complaints/me").set(bearer(tokenFor(A)));
    const mineB = await api().get("/api/complaints/me").set(bearer(tokenFor(B)));
    expect(mineA.body.data).toHaveLength(1);
    expect(mineB.body.data).toHaveLength(0);
  });

  it("only accepts a booking code from the customer's own account", async () => {
    await prisma.booking.create({ data: { userId: B, date: "2026-10-01", startTime: "18:00", endTime: "19:00", duration: 1, customerName: "B", basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", status: "confirmed", code: "UF-CMPL01" } });
    expect((await send(A, { ...good, bookingCode: "UF-CMPL01" })).status).toBe(400);
    expect((await send(A, { ...good, bookingCode: "UF-NOSUCH" })).status).toBe(400);
    const ok = await send(B, { ...good, bookingCode: "uf-cmpl01" });
    expect(ok.status).toBe(201);
    expect(ok.body.data.bookingCode).toBe("UF-CMPL01");
  });
});

describe("complaints: photos", () => {
  it("compresses a photo to a small JPEG and saves it under a server-chosen name", async () => {
    const r = await send(B, { ...good, photos: [await png()] });
    expect(r.status).toBe(201);
    const url: string = r.body.data.photos[0];
    expect(url).toMatch(/^\/uploads\/complaints\/CP-[A-Z2-9]{6}-1-[0-9a-f]{8}\.jpg$/);
    const file = path.join(process.cwd(), url);
    files.push(file);
    expect(fs.existsSync(file)).toBe(true);
    expect((await sharp(file).metadata()).format).toBe("jpeg");
  });

  it("refuses more than 3 photos, non-images and files that only claim to be images", async () => {
    const p = await png();
    expect((await send(B, { ...good, photos: [p, p, p, p] })).status).toBe(400);
    expect((await send(B, { ...good, photos: ["data:text/html;base64,PHNjcmlwdD4="] })).status).toBe(400);
    expect((await send(B, { ...good, photos: ["data:image/png;base64," + Buffer.from("this is not a picture").toString("base64")] })).status).toBe(400);
    expect((await send(B, { ...good, photos: ["https://evil.example/x.png"] })).status).toBe(400);
    expect((await send(B, { ...good, photos: "nope" })).status).toBe(400);
  });

  it("saves nothing when one of the photos is bad", async () => {
    const before = fs.existsSync(path.join(process.cwd(), "uploads", "complaints")) ? fs.readdirSync(path.join(process.cwd(), "uploads", "complaints")).length : 0;
    const r = await send(B, { ...good, photos: [await png(), "data:image/png;base64,AAAA"] });
    expect(r.status).toBe(400);
    const after = fs.existsSync(path.join(process.cwd(), "uploads", "complaints")) ? fs.readdirSync(path.join(process.cwd(), "uploads", "complaints")).length : 0;
    expect(after).toBe(before);
  });
});

describe("complaints: limits and staff", () => {
  it("allows 5 complaints a day per customer, then asks them to wait", async () => {
    await prisma.complaint.deleteMany({ where: { userId: A } });
    for (let i = 0; i < 5; i++) expect((await send(A, good)).status).toBe(201);
    const r = await send(A, good);
    expect(r.status).toBe(429);
    expect((await send(B, good)).status).toBe(201); // another customer is not affected
  });

  it("customers cannot use the staff routes", async () => {
    expect((await api().get("/api/complaints/admin").set(bearer(tokenFor(A)))).status).toBe(403);
    expect((await api().patch("/api/complaints/admin/x").set(bearer(tokenFor(A))).send({ status: "resolved" })).status).toBe(403);
  });

  it("staff list complaints, reply, change the status, and the customer is notified", async () => {
    await prisma.complaint.deleteMany({ where: { userId: A } });
    await prisma.notification.deleteMany({ where: { userId: A } });
    const c = (await send(A, good)).body.data;
    const list = await api().get("/api/complaints/admin?status=open").set(bearer(adminToken()));
    expect(list.status).toBe(200);
    const mine = list.body.data.items.find((i: { id: string }) => i.id === c.id);
    expect(mine.customerName).toBe("Complainer A");
    expect(mine.userId).toBe(A);

    expect((await api().patch(`/api/complaints/admin/${c.id}`).set(bearer(adminToken())).send({ status: "bogus" })).status).toBe(400);
    const upd = await api().patch(`/api/complaints/admin/${c.id}`).set(bearer(adminToken())).send({ status: "resolved", reply: "We fixed the light. Sorry about that." });
    expect(upd.status).toBe(200);
    expect(upd.body.data.status).toBe("resolved");
    expect(upd.body.data.staffReply).toBe("We fixed the light. Sorry about that.");
    expect(upd.body.data.resolvedAt).toBeTruthy();

    const note = await prisma.notification.findFirst({ where: { userId: A, type: "complaint" } });
    expect(note?.title).toContain(c.code);
    expect(note?.message).toContain("We fixed the light");
    expect(note?.href).toBe("/complaints");

    const mineNow = await api().get("/api/complaints/me").set(bearer(tokenFor(A)));
    expect(mineNow.body.data[0].staffReply).toContain("We fixed the light");
    expect((await api().get("/api/complaints/admin?status=resolved").set(bearer(adminToken()))).body.data.total).toBeGreaterThanOrEqual(1);
    expect((await api().patch("/api/complaints/admin/unknown-id").set(bearer(adminToken())).send({ status: "closed" })).status).toBe(404);
    expect(ADMIN_ID).toBe("admin-test");
  });
});
