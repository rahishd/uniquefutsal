import { api, prisma, makeUser, tokenFor, bearer, wipeTestData } from "./helpers";
import { setPushSender, allowPushWithoutKeysForTests } from "../src/modules/push/push.service";
import notificationService from "../src/modules/notification/notification.service";

const PHONE = "9811900001";
const sent: { endpoint: string; payload: string }[] = [];

beforeAll(async () => {
  allowPushWithoutKeysForTests(true);
  setPushSender(async (sub, payload) => {
    if (sub.endpoint.includes("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
    sent.push({ endpoint: sub.endpoint, payload });
  });
  await makeUser(PHONE, "Push Tester");
});
afterAll(async () => {
  setPushSender(null);
  allowPushWithoutKeysForTests(false);
  await prisma.pushSubscription.deleteMany({ where: { userId: PHONE } });
  await prisma.notification.deleteMany({ where: { userId: PHONE } });
  await prisma.userPrefs.deleteMany({ where: { userId: PHONE } });
  await wipeTestData([PHONE]);
  await prisma.$disconnect();
});
beforeEach(async () => {
  sent.length = 0;
  await prisma.notification.deleteMany({ where: { userId: PHONE } });
  await prisma.userPrefs.deleteMany({ where: { userId: PHONE } });
});

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p", auth: "a" } });

test("a notice also reaches every subscribed device, and a dead device is removed", async () => {
  const t = tokenFor(PHONE);
  await api().post("/api/me/push-subscriptions").set(bearer(t)).send(sub("https://push.test/one")).expect(201);
  await api().post("/api/me/push-subscriptions").set(bearer(t)).send(sub("https://push.test/gone")).expect(201);
  await notificationService.notify({ userId: PHONE, type: "booking", title: "Booked", message: "Done", href: "/profile", dedupeKey: "t1" });
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0].payload)).toMatchObject({ title: "Booked", href: "/profile" });
  expect(await prisma.pushSubscription.count({ where: { userId: PHONE } })).toBe(1);
});

test("the same notice is not pushed twice", async () => {
  await prisma.pushSubscription.upsert({ where: { endpoint: "https://push.test/one" }, update: { userId: PHONE }, create: { userId: PHONE, endpoint: "https://push.test/one", p256dh: "p", auth: "a" } });
  const n = { userId: PHONE, type: "booking" as const, title: "Once", message: "m", dedupeKey: "t2" };
  await notificationService.notify(n);
  await notificationService.notify(n);
  expect(sent).toHaveLength(1);
});

test("pop-up reminder off: no push for the 1-hour reminder; promos off: no promo push", async () => {
  await prisma.pushSubscription.upsert({ where: { endpoint: "https://push.test/one" }, update: { userId: PHONE }, create: { userId: PHONE, endpoint: "https://push.test/one", p256dh: "p", auth: "a" } });
  await prisma.userPrefs.create({ data: { userId: PHONE, popupReminder: false, promoNotifications: false } });
  await notificationService.notify({ userId: PHONE, type: "reminder", title: "Soon", message: "m", dedupeKey: "t3" });
  await notificationService.notify({ userId: PHONE, type: "promo", title: "Offer", message: "m", dedupeKey: "t4" });
  expect(sent).toHaveLength(0);
  expect(await prisma.notification.count({ where: { userId: PHONE } })).toBe(2); // the bell still gets both
});

test("public key endpoint answers without login", async () => {
  const r = await api().get("/api/push/public-key").expect(200);
  expect(r.body.data).toHaveProperty("publicKey");
});
