import { api, prisma } from "./helpers";
import { isLive } from "../src/modules/content/content.service";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const T = "ctest";
const base = { active: true, startDate: null, endDate: null, dailyStart: null, dailyEnd: null, days: [] as number[] };
// Nepal is UTC+5:45, so 06:30 in Nepal is 00:45 UTC. 2026-10-06 is a Tuesday.
const at = (hhmm: string, day = "2026-10-06") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.parse(`${day}T00:00:00Z`) + (h * 60 + m - 345) * 60000);
};

async function wipe() {
  await prisma.siteAd.deleteMany({ where: { createdBy: T } });
  await prisma.siteGallery.deleteMany({ where: { createdBy: T } });
  await prisma.contentMedia.deleteMany({ where: { createdBy: T } });
}
async function media() {
  return prisma.contentMedia.create({ data: { mime: "image/png", data: PNG, width: 1, height: 1, bytes: PNG.length, createdBy: T } });
}
beforeAll(wipe);
afterAll(wipe);

describe("content: when is an ad live (Nepal time)", () => {
  it("honours the date range, the days of the week and paused ads", () => {
    expect(isLive(base, at("12:00"))).toBe(true);
    expect(isLive({ ...base, active: false }, at("12:00"))).toBe(false);
    expect(isLive({ ...base, startDate: "2026-10-07" }, at("12:00"))).toBe(false);
    expect(isLive({ ...base, endDate: "2026-10-05" }, at("12:00"))).toBe(false);
    expect(isLive({ ...base, startDate: "2026-10-06", endDate: "2026-10-06" }, at("23:59"))).toBe(true);
    expect(isLive({ ...base, days: [2] }, at("12:00"))).toBe(true); // Tuesday
    expect(isLive({ ...base, days: [0, 6] }, at("12:00"))).toBe(false);
  });

  it("a 6:00 to 7:00 AM ad shows only in that hour", () => {
    const coke = { ...base, dailyStart: "06:00", dailyEnd: "07:00" };
    expect(isLive(coke, at("05:59"))).toBe(false);
    expect(isLive(coke, at("06:00"))).toBe(true);
    expect(isLive(coke, at("06:59"))).toBe(true);
    expect(isLive(coke, at("07:00"))).toBe(false);
  });

  it("a window that runs past midnight works", () => {
    const night = { ...base, dailyStart: "22:00", dailyEnd: "02:00" };
    expect(isLive(night, at("23:30"))).toBe(true);
    expect(isLive(night, at("01:30"))).toBe(true);
    expect(isLive(night, at("12:00"))).toBe(false);
  });
});

describe("content: what the app receives", () => {
  it("gives visible gallery photos and live ads, grouped by placement, without signing in", async () => {
    const m1 = await media(), m2 = await media(), m3 = await media(), m4 = await media(), m5 = await media();
    await prisma.siteGallery.create({ data: { title: "Match night", mediaId: m1.id, orientation: "landscape", createdBy: T, sortOrder: -5 } });
    await prisma.siteGallery.create({ data: { title: "Hidden", mediaId: m2.id, orientation: "portrait", visible: false, createdBy: T } });
    const mk = (mediaId: string, title: string, over: object) => prisma.siteAd.create({ data: { title, mediaId, placement: "header", createdBy: T, ...over } });
    await mk(m3.id, "Always", { placement: "header", priority: 5 });
    await mk(m4.id, "Never today", { placement: "footer", days: [0] });
    await mk(m5.id, "Paused", { placement: "popup", active: false });
    const r = await api().get("/api/content/active");
    expect(r.status).toBe(200);
    const g = r.body.data.gallery.filter((x: { title: string }) => ["Match night", "Hidden"].includes(x.title));
    expect(g.map((x: { title: string }) => x.title)).toEqual(["Match night"]);
    expect(g[0].imageUrl).toBe(`/api/content/media/${m1.id}`);
    const header = r.body.data.ads.header.filter((a: { title: string }) => a.title === "Always");
    expect(header).toHaveLength(1);
    expect(header[0]).toMatchObject({ displaySeconds: 6 });
    expect(r.body.data.ads.footer.some((a: { title: string }) => a.title === "Never today")).toBe(false);
    expect(r.body.data.ads.popup.some((a: { title: string }) => a.title === "Paused")).toBe(false);
  });

  it("serves a picture with long caching, and 404 for an unknown one", async () => {
    const m = await media();
    const ok = await api().get(`/api/content/media/${m.id}`);
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toBe("image/png");
    expect(ok.headers["cache-control"]).toContain("immutable");
    expect(ok.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(Buffer.from(ok.body).length).toBe(PNG.length);
    expect((await api().get("/api/content/media/nope")).status).toBe(404);
  });

  it("counts views and clicks only for live ads", async () => {
    const m = await media(), p = await media();
    const live = await prisma.siteAd.create({ data: { title: "Counted", mediaId: m.id, placement: "inline", createdBy: T } });
    const off = await prisma.siteAd.create({ data: { title: "Off", mediaId: p.id, placement: "inline", active: false, createdBy: T } });
    expect((await api().post(`/api/content/ads/${live.id}/view`)).status).toBe(204);
    expect((await api().post(`/api/content/ads/${live.id}/click`)).status).toBe(204);
    expect((await api().post(`/api/content/ads/${off.id}/view`)).status).toBe(204);
    expect((await api().post("/api/content/ads/unknown/click")).status).toBe(204);
    const a = await prisma.siteAd.findUnique({ where: { id: live.id } });
    const b = await prisma.siteAd.findUnique({ where: { id: off.id } });
    expect([a!.impressions, a!.clicks, b!.impressions]).toEqual([1, 1, 0]);
  });
});

describe("website visits", () => {
  const id = "visitortestid0001abcd";
  beforeAll(() => prisma.siteVisit.deleteMany({ where: { visitor: { startsWith: "visitortestid" } } }));
  afterAll(() => prisma.siteVisit.deleteMany({ where: { visitor: { startsWith: "visitortestid" } } }));

  it("counts one visitor per day and their page views, ignores bad ids, keeps no personal data", async () => {
    expect((await api().post("/api/content/visit").send({ visitor: id })).status).toBe(204);
    expect((await api().post("/api/content/visit").send({ visitor: id })).status).toBe(204);
    expect((await api().post("/api/content/visit").send({ visitor: "short" })).status).toBe(204);
    expect((await api().post("/api/content/visit").send({})).status).toBe(204);
    const rows = await prisma.siteVisit.findMany({ where: { visitor: { startsWith: "visitortestid" } } });
    expect(rows).toHaveLength(1);
    expect(rows[0].pages).toBe(2);
    expect(rows[0].registered).toBe(false);
    expect(Object.keys(rows[0]).sort()).toEqual(["day", "firstAt", "id", "lastAt", "pages", "registered", "visitor"]);
  });
});
