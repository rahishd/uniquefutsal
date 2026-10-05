import webpush from "web-push";
import env from "../../config/env";
import logger from "../../config/logger";
import { prisma } from "../../config/db";

export interface PushPayload {
  title: string;
  body: string;
  href?: string;
  tag?: string;
}

// The sender is a seam so tests can capture pushes without a real push service.
export type PushSender = (sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<unknown>;

let configured = false;
function configure(): boolean {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

let sender: PushSender = (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600 });
export const setPushSender = (s: PushSender | null) => {
  sender = s ?? ((sub, payload) => webpush.sendNotification(sub, payload, { TTL: 3600 }));
};

// Notice types a customer can switch off, and the one tied to the "Pop-up reminder" switch.
const PROMO_TYPES = new Set(["promo"]);

export class PushService {
  get enabled() {
    return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  }

  get publicKey() {
    return env.VAPID_PUBLIC_KEY;
  }

  // Sends one alert to every device of the customer. Never throws: a failed push must not break a booking or payment.
  // Dead subscriptions (404/410) are removed.
  async sendToUser(userId: string, type: string, payload: PushPayload): Promise<number> {
    try {
      const live = this.enabled && configure();
      if (!live && !isTestSender) return 0;
      const prefs = await prisma.userPrefs.findUnique({ where: { userId } });
      if (prefs) {
        if (PROMO_TYPES.has(type) && !prefs.promoNotifications) return 0;
        // The 1-hour "I'm coming" alert is the pop-up reminder: off means no push for it (the bell still gets the notice).
        if (type === "reminder" && !prefs.popupReminder) return 0;
      }
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      let sent = 0;
      for (const s of subs) {
        try {
          await sender({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload));
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
          else logger.warn(`Push failed (${status ?? "error"})`);
        }
      }
      return sent;
    } catch (err) {
      logger.error("Push send failed", err);
      return 0;
    }
  }
}

let isTestSender = false;
export const allowPushWithoutKeysForTests = (v: boolean) => {
  isTestSender = v;
};

export const pushService = new PushService();
export default pushService;
