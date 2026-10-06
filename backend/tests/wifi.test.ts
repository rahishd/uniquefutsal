import { api, bearer, makeUser, prisma, tokenFor } from "./helpers";
import { wifiQr } from "../src/modules/wifi/wifi.routes";

const PHONE = "9800009301";
const keys = ["wifiSSID", "wifiPassword", "wifiVisible"];
let saved: { key: string; value: string }[] = [];
const put = (key: string, value: string) => prisma.settings.upsert({ where: { key }, create: { key, value }, update: { value } });

beforeAll(async () => {
  saved = await prisma.settings.findMany({ where: { key: { in: keys } }, select: { key: true, value: true } });
  await makeUser(PHONE, "Wifi Tester");
});
afterAll(async () => {
  await prisma.settings.deleteMany({ where: { key: { in: keys } } });
  for (const s of saved) await put(s.key, s.value);
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

    expect((await api().get("/api/wifi")).status).toBe(401);
    const on = await api().get("/api/wifi").set(bearer(tokenFor(PHONE)));
    expect(on.status).toBe(200);
    expect(on.body.data).toMatchObject({ visible: true, ssid: "Unique Futsal Public WiFi", password: "goal-2026", open: false });
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
});
