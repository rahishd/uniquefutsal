<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: Unique Futsal customer PWA

Mobile-first customer PWA (Next.js App Router, TypeScript, Tailwind 4). Spec: the FRD in git tag `legacy-original` under `FRD/` (FRD-001). The previous codebase is preserved at tag `legacy-original`.

- Commands: `npm run dev`, `npm run build`, `npm run lint`.
- Data lives in a separate backend/database. Never point development at production data or commit secrets (`.env*` is git-ignored).
- Placeholder data is in `lib/sample-data.ts`; replace with real API calls as endpoints become available.
- Keep price, promo, loyalty and payment-status logic on the server, never trust the browser.
- Put new FRDs in `FRD/`.

# Deferred until the production database exists

**Closed-app alerts (Web Push).** Today reminders, the notification centre and the full-screen "I'm coming" check-in only work while the app is open (`components/ReminderScheduler.tsx`, `components/ArrivalPrompt.tsx`, `lib/notifications.ts`, `lib/arrival.ts`). To reach a closed app the server must:
1. Generate VAPID keys; expose the public key to the app.
2. Store each customer's push subscription (`PushManager.subscribe` result) against their account.
3. Run a scheduled job that sends a push 1 hour before every confirmed booking, and on challenge and payment events.
4. Receive the "I'm coming" check-in (`POST /api/bookings/:id/arrival`, replacing the stub in `lib/arrival.ts`) and alert admin.

The service worker (`public/sw.js`) already handles `push` and `notificationclick`. Limits: iPhone only supports Web Push for the home-screen-installed app (iOS 16.4+), and a push shows as a normal notification, not full screen; tapping it opens the app, which then shows the full-screen check-in.

# Payments (QR) — needs the real gateway

Bookings and membership share `lib/payment.ts`, `components/payment/PaymentMethodPicker.tsx` and `components/payment/PaymentQr.tsx`. Methods: eSewa, Fonepay, Pay at venue. For eSewa/Fonepay the app shows a QR for the final amount (after promo codes) with remarks "Regular game / Membership renew / Membership purchase - <order id>", valid for 10 minutes (`QR_HOLD_MS`).

The QR is a DEMO placeholder (`demoQrPayload`). In production the server must create the real merchant QR with the gateway for the exact amount and remarks, return it to the app, and confirm payment only from the gateway callback or verification API. "I've paid" must never mark an order paid; it only tells the server to expect the payment (optionally with the customer's transaction ID).
