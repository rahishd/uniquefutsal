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

# Promos page

`/promos` (`components/promos/PromosPage.tsx`) lists offers in Active / Upcoming / Expired tabs, worked out from today's date against each promo's `from` and `until` (`lib/promos.ts`). Active cards have a Copy button and a Book / View plans button; "Ends in N days" shows for offers ending within 5 days. The Home "Live promo codes" strip shows the same active codes. Data is sample data and must match the codes the booking (`lib/booking.ts`) and membership (`lib/membership.ts`) screens accept; TIHAR20 and MONSOON15 are display-only because those screens don't know them. The server must own the codes, dates, eligibility and discount, and validate again at payment. Promo notifications (`type: "promo"`) show the red badge on the Promos tile.

# Home banner mascot

The football on the Home promo banner is now `components/KidSkills.tsx`: a smiling cartoon boy in an orange kit doing a 20-second routine on a loop (dribble, foot juggling, headers, ball spinning on a finger, "around the world", jump with a spin). It is pure SVG with generated CSS keyframes, no video or image files, and it stops moving when the device has "reduce motion" on. To change the routine, edit the point lists (`ballPath`, `legL`, `legR`, `armL`, `armR`, `bob`, `head`, `spin`); times are in seconds and `LOOP` is the total length.

# Loyalty points

Page `/points` (`components/points/PointsPage.tsx`); rules, expiry, store and sample ledger in `lib/points.ts`. Only the registered account holder (the main person) earns; guests earn nothing.

Earning: a regular game earns price / 100 points, kept to one decimal (Rs. 1,250 = 12.5). 10 games = 1 free game of that shift, so a free game costs price / 10 (Rs. 1,250 = 125, 1,150 = 115, 1,350 = 135; the page computes these from `priceFor` in `lib/booking.ts`). Extra goods: every Rs. 100 = 1 point (Rs. 10,000 = 100). Membership purchase or renewal: 3 months = 30, 6 months = 70, monthly = 0 (`MEMBERSHIP_POINTS`). Challenge games: only the winning captain, 5 points. Points are earned on the amount actually paid; free-game bookings earn none.

Expiry: game and challenge points last 3 months from the game; extra-goods points 1 year; membership points never expire. This is per earning (each game's points expire 3 months after that game), which means a customer must collect 10 games' worth inside 3 months, and no games for 3 months empties the game points. If the owner meant a cycle that starts at the first game and restarts after a claim, change `expiryFor` and `buildLots`. Claiming spends the points that expire soonest first (never-expiring last) and can only spend points valid on the claim day. The page warns when points expire within 30 days, shows valid points per type with the next expiry, tags history rows (valid until / never expires / used / expired) and lists the terms.

Claiming: on /points the customer picks a shift and spends its cost to get a voucher (`claimFreeGame(period)`). At the booking review step, a voucher for the chosen slot's shift can be applied ("Use a free game voucher"): total Rs. 0, no payment step, voucher spent (`spendVoucher`). Regular bookings only, never for hosting a challenge. Vouchers have no expiry in the demo (not specified by the owner).

Everything is sample data in browser storage. The server must own the ledger, expiry and vouchers: award game points only after the game is completed and paid, goods points when goods are sold, membership points when the payment is confirmed (all idempotent per id), expire them on schedule, deduct on claim, and re-check on booking that the voucher is unused and matches the shift. `awardGame` and the goods points have no trigger in the demo yet.

# Help page

`/help` (`components/help/HelpPage.tsx`) is opened from the "Help" tile in Popular (it replaced the old "More" tile). Its topics live ONLY in `lib/help.ts` (`helpTopics`: title, one-line summary, short points, optional button). Numbers such as the booking window, renewal notice days, points rules and membership points are read from `lib/booking.ts`, `lib/membership.ts` and `lib/points.ts`, so they stay correct when those change. **Whenever a customer-facing feature is added or changed, update `lib/help.ts` in the same change** (add a topic, or edit the wording). The page has a search box and Call / WhatsApp buttons from `lib/site.ts`.

# Urgent help (WhatsApp)

`components/WhatsAppChat.tsx`: a floating green WhatsApp button on Home only (bottom right, above the bottom bar). It opens a sheet with topics (booking, payment, change or cancel, membership, other) and a Call button. Each topic opens `wa.me/<number>` with a pre-written message; the number comes from `site.whatsapp` / `site.phone` in `lib/site.ts`. No personal data goes in the link. This opens WhatsApp itself, it is not a chat inside the app: a real in-app chat with admin needs the backend (messages, admin inbox) or the WhatsApp Business Cloud API with a chatbot.

# Gamezone (PS5)

`/gamezone` (`components/gamezone/GamezoneFlow.tsx`, data layer `lib/gamezone.ts`), opened from the "Gamezone" tile in Popular. Price per hour per person: Solo Rs. 300, 2 players Rs. 200 each, 4 players Rs. 150 each; more hours multiply the same rate (total = rate x players x hours, 1 to 4 hours). Same rules as court bookings: up to 10 days ahead, only free start times are listed, registered customers can pay at the venue, guests pay in full online (eSewa/Fonepay QR with remarks "Gamezone PS5 - <id>", paid status detected automatically), 1-hour reminder. Gamezone notices use `type: "gamezone"` (own badge on the tile and bell icon).

ASSUMPTIONS to confirm with the owner and set in `lib/gamezone.ts`: two consoles (`CONSOLES`), sessions between 10 AM and 10 PM (`OPEN_HOUR`, `CLOSE_HOUR`), 4 hours maximum (`MAX_HOURS`), only 1, 2 or 4 players, no promo codes and no loyalty points for Gamezone, and the bookings do not appear in Profile > My bookings yet. Availability is pseudo-random demo data; the server must own availability, price and payment status.

Gamezone update: the customer chooses the console first (PS5 Station 1 or 2) and the start times shown are for THAT console only (`getGzSlots(key, now, hours, consoleId)`), so switching consoles changes the free slots. They must also choose a game from `GAMES` in `lib/gamezone.ts` (demo list: GTA 5, Forza Horizon, Red Dead Redemption, FIFA 26); the game is stored on the booking and shown in the summary, confirmation and notice. Console availability is demo data; the real server must hold per-console bookings and the list of games.

# Company header and footer

`components/CompanyHeader.tsx` (rendered in `app/layout.tsx`) is the pinned top bar on EVERY page: the logo (`public/logo.jpg`, shown as a small tile zoomed on the player) and "UNIQUE FUTSAL". It is sticky, so it never scrolls away. On Home the greeting ("Hello Player" with the bell) sits just below it. The footer on Home no longer repeats the logo, description and rating (name, blurb and rating in `lib/site.ts` are now unused); it keeps Contact us, Follow us and the map.

# Backend goes with every feature

The backend lives in the sibling folder `uniquefutsal-backend` (its own git repo; see its `README.md` and `docs/API.md`). **Whenever a customer-facing feature is added or changed here, add or update the matching backend in the same piece of work**: an additive, idempotent migration, the service and routes with the rules enforced on the server, tests, and a row in `docs/API.md`. Never point development at production data; use the local database only.
