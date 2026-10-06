import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";
import SettingsService from "../settings/settings.service";

// Venue Wi-Fi for signed-in customers. Staff set the name and password (and the on/off switch) in the admin portal (Settings keys
// wifiSSID, wifiPassword, wifiVisible). The password is NEVER sent to guests or in the public /settings answer.
export const wifiRouter = Router();

// Wi-Fi QR text. Special characters in the name and password must be escaped for phones to read it.
const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
export const wifiQr = (ssid: string, password: string) => (password ? `WIFI:T:WPA;S:${esc(ssid)};P:${esc(password)};;` : `WIFI:T:nopass;S:${esc(ssid)};;`);

wifiRouter.get("/", authMiddleware, asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [ssid, password, visible] = await Promise.all([
    SettingsService.getSetting("wifiSSID"), SettingsService.getSetting("wifiPassword"), SettingsService.getSetting("wifiVisible"),
  ]);
  const shown = Boolean(ssid) && visible !== "false";
  res.set("Cache-Control", "no-store");
  res.json(ApiResponseUtil.success(200, "Wi-Fi", shown ? { visible: true, ssid, password: password ?? "", open: !password, qr: wifiQr(ssid!, password ?? "") } : { visible: false }));
}));
