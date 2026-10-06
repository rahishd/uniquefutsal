import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { isAtVenue, wifiQr } from "../src/modules/wifi/wifi.routes";

const PHONE = "9800009301";
const keys = ["wifiSSID", "wifiPassword", "wifiVisible", "wifiAccess"];
let saved: { key: string; value: string }[] = [];
const put = (key: string, value: string) => prisma.settings.upsert({ where: { key }, create: { key, value }, update: { value } });

beforeAll(async () => {
  saved = await prisma.settings.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  await makeUser(PHONE, "Wifi Tester");
});
afterAll(async () => {
  await prisma.settings.deleteMany({ where: { key: { in: keys } } });
  for (const s of saved) await put(s.key, s.value);
  await prisma.booking.deleteMany({ where: { userId: PHONE } });
  await prisma.user.deleteMany({ where: { phoneNumber: PHONE } });
});

describe("venue Wi-Fi", () => {
  it("escapes special characters in the QR text", () => {
    expect(wifiQr("Unique Futsal", "pass")).toBe("WIFI:T:WPA;S:Unique Futsal;P:pass;;");
    expect(wifiQr("a;b", 'p:"q\\,')).toBe('WIFI:T:WPA;S:a\\;b;P:p\\:\\"q\\\\\\,;;');
    expect(wifiQr("Open", "")).toBe("WIFI:T:nopass;S:Open;;");
  });

  it("is for signed-in customers only, never in the public settings, and respects the on/off switch", async () => {
    await put("wifiSSID", "Unique Futsal Public WiFi");
    await put("wifiPassword", "goal-2026");
    await prisma.settings.deleteMany({ where: { key: "wifiVisible" } });
    await put("wifiAccess", "all");

    expect((await api().get("/api/wifi")).status).toBe(401);
    const on = await api().get("/api/wifi").set(bearer(tokenFor(PHONE)));
    expect(on.status).toBe(200);
    expect(on.body.data).toMatchObject({ visible: true, locked: false, ssid: "Unique Futsal Public WiFi", password: "goal-2026", open: false });
    expect(on.body.data.qr).toContain("S:Unique Futsal Public WiFi;P:goal-2026");

    const pub = await api().get("/api/settings");
    expect(JSON.stringify(pub.body)).not.toContain("goal-2026");
    expect(JSON.stringify(pub.body)).not.toContain("Unique Futsal Public WiFi");

    await put("wifiVisible", "false");
    const off = await api().get("/api/wifi").set(bearer(tokenFor(PHONE)));
    expect(off.body.data).toEqual({ visible: false });
    expect(JSON.stringify(off.body)).not.toContain("goal-2026");

    await put("wifiVisible", "true");
    await put("wifiSSID", "");
    expect((await api().get("/api/wifi").set(bearer(tokenFor(PHONE)))).body.data).toEqual({ visible: false });
  });

  it("by default only a customer with a game around now gets the password", async () => {
    await put("wifiSSID", "Unique Futsal Public WiFi");
    await put("wifiPassword", "goal-2026");
    await put("wifiVisible", "true");
    await prisma.settings.deleteMany({ where: { key: "wifiAccess" } });

    const locked = await api().get("/api/wifi").set(bearer(tokenFor(PHONE)));
    expect(locked.body.data.locked).toBe(true);
    expect(JSON.stringify(locked.body)).not.toContain("goal-2026");
    expect(JSON.stringify(locked.body)).not.toContain("WIFI:T");

    // a game 19:00-20:00 on a fixed day (Nepal time)
    await prisma.booking.create({ data: { userId: PHONE, date: "2031-03-04", startTime: "19:00", endTime: "20:00", duration: 1, basePrice: 1000, subtotal: 1000, totalPrice: 1000, paymentMethod: "venue", paymentStatus: "pending", status: "confirmed", code: "UF-WIFI01" } });
    const nepal = (hhmm: string) => new Date(`2031-03-04T${hhmm}:00+05:45`);
    expect(await isAtVenue(PHONE, nepal("17:30"))).toBe(false); // more than an hour before
    expect(await isAtVenue(PHONE, nepal("18:05"))).toBe(true);
    expect(await isAtVenue(PHONE, nepal("19:40"))).toBe(true);
    expect(await isAtVenue(PHONE, nepal("20:25"))).toBe(true);
    expect(await isAtVenue(PHONE, nepal("20:45"))).toBe(false); // more than 30 minutes after
    await prisma.booking.updateMany({ where: { userId: PHONE }, data: { status: "cancelled" } });
    expect(await isAtVenue(PHONE, nepal("19:40"))).toBe(false); // cancelled games do not count

    // a game that runs past midnight: 23:00-00:00
    await prisma.booking.updateMany({ where: { userId: PHONE }, data: { status: "confirmed", startTime: "23:00", endTime: "00:00" } });
    expect(await isAtVenue(PHONE, new Date("2031-03-05T00:10:00+05:45"))).toBe(true);
    expect(await isAtVenue(PHONE, new Date("2031-03-05T00:45:00+05:45"))).toBe(false);
  });
});
