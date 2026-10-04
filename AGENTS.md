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

**Payments are detected automatically; the customer never confirms.** While the QR is open, `PaymentQr` calls `fetchPaymentStatus(orderId)` every 3 seconds (and when the tab becomes visible again). When it returns `"paid"` the booking is confirmed (or the membership activated or extended) and "Payment received" is shown. There is no "I've paid" button.

What your server must provide (replace the demo code in `lib/payment.ts`, `lib/booking.ts`, `lib/membership.ts`):
1. Create the order and return the REAL merchant QR from eSewa/Fonepay for the exact amount and remarks. The current QR is a placeholder (`demoQrPayload`).
2. `GET /api/payments/:orderId/status` returning `pending` or `paid`. Set `paid` only after the gateway confirms it (callback/webhook, or the gateway's payment status API). Never trust the browser. Make callbacks idempotent.
3. Re-check availability inside a transaction, recompute price and promo server-side, and expire unpaid orders after the QR hold.
4. Remove the demo-only pieces: `DEMO_PAYMENTS`, `demoSimulatePayment` and the "Demo: simulate payment received" button.

# Registered customers vs guests

`lib/session.ts` says who is using the app. DEMO: it starts signed in as the sample customer and "Sign out" (Profile) makes the visitor a guest; "Sign in (demo)" and "Have an account? Sign in" reverse it. Replace it with the real session from your login (for example a cookie plus `GET /api/auth/me`).

- **Registered:** booking and membership never ask for name or mobile number; they use the account ("Booking as ..."). All payment methods are available, including Pay at venue.
- **Guest:** must enter name and a valid mobile number, and must pay the full amount online (eSewa or Fonepay). Pay at venue is hidden. Guests have no membership, booking history or Quick Rebook.
- The guest rule is also checked in `createBooking` and `purchaseMembership` (`guest` flag), but the real server must enforce it too and take identity from the session, never from the request body.

# Captain mode, teams, challenges and ratings

Code: `lib/teams.ts` (data, store, 5-star rating) and `components/captain/*`. Pages: `/opponent` (teams leaderboard, challenges, results), `/opponent/team/[id]` (another team's stats: rating, rank, record, form), `/team` (roster). Profile has a Player/Captain switch; Captain mode shows a gold (C) on the avatar. All of it is DEMO data in localStorage; none of it works across real users until the backend exists.

Rules the app follows (the SERVER must enforce all of them):
- Any registered player can switch to Captain mode and create a team. Guests cannot.
- A team has at most 12 members (captain included). Members are registered players added by mobile number; a player can be in only one team. The captain cannot be removed.
- Only a captain (Captain mode, team of at least 5) can challenge another team. The challenged captain is notified and can see the challenger's team stats (rating, rank, record, form) before answering. There are no individual player stats anywhere: only team stats.
- After a game, the WINNING captain (either side after a draw) uploads just the overall final score (no per-player goals or assists). The OTHER captain approves or disputes. Only approved results change team records and ratings. Disputed results change nothing and need an admin (not built yet).
- **Who pays for a challenge game:** the challenging captain must choose "Loser pays 70%" (winner 30%), "Loser pays 60%" (winner 40%) or "Loser pays in full" (winner pays nothing); nothing is preselected. The amounts come from the court price for the chosen hour. A draw has no loser, so it is split 50/50 (assumption; change `settlement` in `lib/teams.ts` if the rule differs). Challenge games are paid ONLY at the venue after the game: no online payment, no QR. The venue needs the confirmed result to know who owes what, so the server should expose it to staff and mark it paid when they collect. Amounts are rounded to whole rupees and always add up to the court price.
- **"Did you win?" popup:** when venue staff approve the payment in the admin system, the server sets `venuePaidAt` on the challenge and pushes a notification to BOTH captains. `components/captain/WinPrompt.tsx` then shows "Did you win? Update your score in your dashboard and increase your visibility to the public." with an "Update score" button that opens `/opponent?report=<challengeId>` (Results tab, score form open). It shows once per game per captain, only in Captain mode, and not when a score is already uploaded or confirmed. Uploading a score is NOT blocked until payment is confirmed; the popup is the prompt. In the demo, "Admin: mark paid at venue" (`demoAdminMarksPaid`) plays the admin; remove it when the admin panel exists.
- Challenge acceptance must create the court booking inside a transaction so two games cannot take the same slot (FRD section 17).

Rating (`teamRating`): 1.0 to 5.0 stars from approved results only. Score = 55% win rate (draw = half), 25% goal difference per game (capped at +-3), 20% last-5 form, pulled toward the middle for small samples (like 5 virtual games) so a lucky streak cannot reach 5. Teams with under 3 games are "Unrated". Ranking sorts by rating, then games played, then goal difference. Tune the weights in one place.

Demo-only buttons to remove once real: "They accept / They decline", "They approve", and the sample opponent activity created by `createTeam`.

# Home "Popular" tile badges

`components/PopularGrid.tsx` shows a red count on a tile when there are messages for that service (9+ for ten or more). A tile counts unread notifications of its own types: Book (booking, reminder, payment), Membership (membership), Points (points), Promos (promo), Tournaments (tournament). Opening a tile marks its messages read (`markReadByTypes`). To make a tile show messages, create notifications with the matching `type` (the server or `addNotice`). Opponent is action based, not read based: it counts challenges waiting for your answer plus results waiting for your approval (`pendingActions`), so it only clears when the captain acts. Only registered captains in Captain mode see it.

# Settings: Pop-up reminder

Profile > Settings has a "Pop-up reminder" switch (default on) next to "Booking reminders (SMS)" and "Promotional notifications". It controls the full-screen "I'm coming" slider shown 1 hour before a game (`components/ArrivalPrompt.tsx`). When off, the slider never covers the screen, but the 1-hour bell notification still arrives. All three switches are saved by `lib/prefs.ts` (browser storage for now). Move them to the customer's account on the server so they follow the customer across devices, and have the server skip the "I'm coming" push when `popup` is off. The SMS and promo switches are saved but nothing sends SMS or promos yet.

# Profile history sections

My bookings shows only the next game and the last completed game; Gameplay stats shows only the most recent game (season totals and earlier games are under the arrow); Payment history shows the two latest transactions. When there is more, a dropdown arrow reveals the rest and "Download PDF" exports the full list (`lib/pdf.ts`, jsPDF, loaded only on click). Everything shown is sample data in `lib/sample-profile.ts`. With a real API, fetch the newest items first and let the expand/PDF actions page through or request the full history (the PDF should be generated from the complete server-side history, not just what is loaded). Payment history excludes pay-at-venue bookings until the venue marks them paid.

# Loyalty points

Page `/points` (`components/points/PointsPage.tsx`), rules and sample ledger in `lib/points.ts`. Rules: 100 points = 1 free game; every completed game earns 10; the WINNING captain of a challenge game earns 5 instead of 10 (assumption: the losing captain and a draw earn the normal 10; change in one place if the rule differs); every full Rs. 100 of extra goods earns 5 (Rs. 250 = 10). The page shows Remaining points, Claimed points (already turned into free games), free games ready and progress to the next one. The Profile "Loyalty points" card uses the same numbers. The ledger is sample data: the server must own it, award points only from completed/paid records, deduct 100 per free game used, and apply the free game at booking (not built yet: there is no "use free game" step in the booking flow).
