import { SiteAd } from "@prisma/client";
import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { currentTime, todayKey, weekdayOfKey } from "../../utils/dates";

// Site content shown in the app: gallery photos and ads. Staff manage both in the admin portal.
// The server decides what is "live" right now (Nepal time), so a 6:00 AM to 7:00 AM ad appears and disappears by itself.
export const PLACEMENTS = ["header", "footer", "popup", "inline"] as const;
export type Placement = (typeof PLACEMENTS)[number];

type Schedule = Pick<SiteAd, "active" | "startDate" | "endDate" | "dailyStart" | "dailyEnd" | "days">;

// Same rule in the admin portal (server/src/modules/content.ts) so staff see exactly what customers see.
export function isLive(ad: Schedule, now: Date = new Date()): boolean {
  if (!ad.active) return false;
  const today = todayKey(now);
  if (ad.startDate && today < ad.startDate) return false;
  if (ad.endDate && today > ad.endDate) return false;
  if (ad.days.length > 0 && !ad.days.includes(weekdayOfKey(today))) return false;
  if (ad.dailyStart && ad.dailyEnd) {
    const t = currentTime(now);
    // a window like 22:00 to 02:00 runs past midnight
    const inside = ad.dailyStart <= ad.dailyEnd ? t >= ad.dailyStart && t < ad.dailyEnd : t >= ad.dailyStart || t < ad.dailyEnd;
    if (!inside) return false;
  }
  return true;
}

const mediaUrl = (id: string) => `/api/content/media/${id}`;

export class ContentService {
  async active(now: Date = new Date()) {
    const [gallery, ads] = await Promise.all([
      prisma.siteGallery.findMany({ where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 100 }),
      prisma.siteAd.findMany({ where: { active: true }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 100 }),
    ]);
    const live = ads.filter((a) => isLive(a, now));
    const by = (p: Placement) =>
      live.filter((a) => a.placement === p).map((a) => ({
        id: a.id, title: a.title, imageUrl: mediaUrl(a.mediaId), linkUrl: a.linkUrl, displaySeconds: a.displaySeconds,
        ...(p === "popup" ? { popupDelaySeconds: a.popupDelaySeconds, popupFrequency: a.popupFrequency } : {}),
      }));
    return {
      serverTime: now.toISOString(),
      gallery: gallery.map((g) => ({ id: g.id, title: g.title, caption: g.caption, orientation: g.orientation, imageUrl: mediaUrl(g.mediaId) })),
      ads: { header: by("header"), footer: by("footer"), popup: by("popup"), inline: by("inline") },
    };
  }

  async media(id: string) {
    const m = await prisma.contentMedia.findUnique({ where: { id } });
    if (!m) throw new AppError(404, "Not found");
    return m;
  }

  // Counters for staff reports. Only for ads that exist and are live, so they cannot be inflated for hidden ads.
  async count(id: string, field: "impressions" | "clicks") {
    const ad = await prisma.siteAd.findUnique({ where: { id } });
    if (!ad || !isLive(ad)) return;
    await prisma.siteAd.update({ where: { id }, data: { [field]: { increment: 1 } } });
  }
}

export default new ContentService();
