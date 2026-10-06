import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";
import SettingsService from "../settings/settings.service";
import { prisma } from "../../config/db";
import { todayKey } from "../../utils/dates";

// Venue Wi-Fi for signed-in customers who are at the venue. Staff set the name, password, on/off switch and who may see it in the
// admin portal (Settings keys wifiSSID, wifiPassword, wifiVisible, wifiAccess). The password is NEVER sent to guests, to the public
// /settings answer, or (by default) to a customer who has no game, Gamezone session or membership slot around the current time.
export const wifiRouter = Router();

// Wi-Fi QR text. Special characters in the name and password must be escaped for phones to read it.
const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
export const wifiQr = (ssid: string, password: string) => (password ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;` : `WIFI:T:nopass;S:${esc(ssid)};;`);

// Wi-Fi opens this long before a booking starts and stays open this long after it ends.
export const BEFORE_MIN = 60;
export const AFTER_MIN = 30;
const NEPAL = "+05:45";
const at = (date: string, time: string) => Date.parse(`${date}T${time}:00${NEPAL}`);
const addDay = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hhmm = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

// true when `now` is inside [start - 60 min, end + 30 min]; an end at or before the start means the game runs past midnight
function inWindow(date: string, start: string, end: string, now: number): boolean {
  const s = at(date, start);
  let e = at(date, end);
  if (e <= s) e += 86_400_000;
  return now >= s - BEFORE_MIN * 60_000 && now <= e + AFTER_MIN * 60_000;
}

export async function isAtVenue(userId: string, now = new Date()): Promise<boolean> {
  const t = now.getTime();
  const today = todayKey(now);
  const days = [addDay(today, -1), today, addDay(today, 1)]; // a late game started yesterday, or an early one tomorrow, may still count
  const [games, sessions, subs] = await Promise.all([
    prisma.booking.findMany({ where: { OR: [{ userId }, { customerPhone: userId }], date: { in: days }, status: { in: ["confirmed", "completed"] } }, select: { date: true, startTime: true, endTime: true } }),
    prisma.gzBooking.findMany({ where: { userId, date: { in: days }, status: { in: ["confirmed", "completed"] } }, select: { date: true, startHour: true, hours: true } }),
    prisma.membershipSubscription.findMany({ where: { userId, status: "active", startDate: { lte: new Date(`${addDay(today, 1)}T00:00:00Z`) }, endDate: { gte: new Date(`${addDay(today, -1)}T00:00:00Z`) } }, select: { timeSlot: true, startDate: true, endDate: true } }),
  ]);
  if (games.some((g) => inWindow(g.date, g.startTime, g.endTime, t))) return true;
  if (sessions.some((g) => inWindow(g.date, hhmm(g.startHour), hhmm(g.startHour + g.hours), t))) return true;
  return subs.some((m) => {
    const [a, b] = (m.timeSlot ?? "").split("-");
    if (!a || !b) return false;
    return days.some((d) => d >= m.startDate.toISOString().slice(0, 10) && d <= m.endDate.toISOString().slice(0, 10) && inWindow(d, a, b, t));
  });
}

wifiRouter.get("/", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const [ssid, password, visible, access] = await Promise.all([
    SettingsService.getSetting("wifiSSID"), SettingsService.getSetting("wifiPassword"), SettingsService.getSetting("wifiVisible"), SettingsService.getSetting("wifiAccess"),
  ]);
  res.set("Cache-Control", "no-store");
  const send = (data: unknown) => res.json(ApiResponseUtil.success(200, "Wi-Fi", data));
  if (!ssid || visible === "false") return send({ visible: false });
  // default is "booked": only customers who are at the venue now. Staff can open it to every signed-in customer.
  if (access !== "all" && !(await isAtVenue(req.user!.id))) {
    return send({ visible: true, locked: true, message: `Wi-Fi is for customers at the venue. It opens ${BEFORE_MIN} minutes before your game, Gamezone session or membership time, once you have booked.` });
  }
  send({ visible: true, locked: false, ssid, password: password ?? "", open: !password, qr: wifiQr(ssid, password ?? "") });
}));
