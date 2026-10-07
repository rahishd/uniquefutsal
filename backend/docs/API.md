# API for the new customer app

Base URL `/api`. Responses look like `{ success, statusCode, message, data }`. Errors use the same shape with the
HTTP status. Auth is `Authorization: Bearer <token>` (from `/auth/login` or `/auth/signup`).
**Guest** = no token. **User** = signed-in customer. **Captain** = user in Captain mode with a team. **Staff** = admin token.
Times use Nepal time. Dates are `YYYY-MM-DD`. Money is whole rupees.

## Status of the frontend features

| Feature | Status |
|---|---|
| Login, signup (phone + password, OTP off), profile, preferences, Player/Captain mode, push subscriptions | Done |
| Court slots and prices, booking checkout, quote, guest rules, 10-day window, held slot, expiry | Done (single pool of hours; see "Courts") |
| Payments: QR order, status polling, staff mark-paid, expiry job, test gateway | Done. Real Fonepay adapters need merchant keys |
| Promos list and validation | Done (reads the developer's promo codes in Settings) |
| Loyalty points ledger, expiry, free-game vouchers, goods sales, awards | Done |
| Gamezone catalog, per-console slots, booking, payments, cancel | Done |
| Teams, roster (max 12), challenges, results, approval, rating, ranking, disputes, "Did you win?", settlement | Done |
| Notifications, 1-hour reminder, "I'm coming" check-in, Quick Rebook | Done (Web Push sending is not built yet) |
| Tournament tie-sheet | Done |
| Site info | Done |
| Membership for the new app (Basic/Premium x monthly/3/6 months) | **Not built: needs the owner's decision.** The developer's membership module still runs and now awards points |
| Closed-app Web Push, SMS reminders | Not built (needs VAPID keys / SMS provider) |
| Real payment gateway | Not built (needs merchant keys) |

## Auth and profile

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | Guest | `{name, phoneNumber (9XXXXXXXXX), password>=6, email?}` -> `{token, refreshToken, user}`. 409 if the number already exists (an existing account is never taken over) |
| POST | `/auth/login` | Guest | `{identifier: phone, password}`. Limited to 5 tries / 15 min / IP |
| POST | `/auth/refresh` | Guest | `{refreshToken}` |
| GET | `/auth/me` | User | account basics |
| POST | `/auth/check-phone` | Guest | `{exists, isVerified}` only |
| POST | `/auth/verify-otp`, `/resend-otp`, `/forgot-password`, `/reset-password` | - | 503 while `OTP_ENABLED=false` |
| GET/PATCH | `/me/profile` | User | `customerCode, name, phone, email, location, position, status, mode`. Phone cannot change |
| GET/PUT | `/me/preferences` | User | `smsReminders, promoNotifications, popupReminder, language(en/ne)` |
| PUT | `/me/mode` | User | `{mode: player|captain}` |
| GET | `/push/public-key` | Guest | `{enabled, publicKey}` (VAPID) the app needs to subscribe a device |
| POST/DELETE | `/me/push-subscriptions` | User | Web Push subscription of this device. Every new notice is also pushed to all devices (not for promos if promos are off, not for the 1-hour reminder if the pop-up reminder is off; dead devices are removed) |
| GET | `/me/gameplay` | User | `{totals:{games,goals,assists,withStats}, games:[{id,code,date,time,goals,assists}]}`; goals/assists are `null` for older games that were never recorded |
| PUT | `/bookings/:id/player-stats` | Staff | `{stats:[{phone,goals,assists}]}` for a game that has started; replaces a player's numbers; players must be registered |
| GET | `/auth/google/config` | Guest | `{configured, clientId}` for the Google button |
| GET | `/auth/google/status` | User | `{configured, linked, email}` |
| POST | `/auth/google/link`, `/auth/google/unlink` | User | link the Google account (`{idToken}`, verified server-side against `GOOGLE_CLIENT_ID`) used to reset a forgotten password |
| POST | `/auth/reset-password/google` | Guest | `{phoneNumber, idToken, newPassword}`: allowed only when the Google account is the one linked to that number. 5 tries / 15 min / IP |
| GET | `/me/payments` | User | paid games and Gamezone sessions, and final bills made at the venue counter (`kind: "bill"`, with `lines[{type,label,quantity,amount}]` and `points`; a game paid inside a bill is not listed twice). Table `Checkout`, migration `20261013000001_checkouts`, written by the admin portal |

## Courts, bookings, payments

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/bookings/available?date=` | Guest | free slots (existing endpoint) |
| GET | `/bookings/occupancy?date=` | Guest | taken hours only; staff with a token also see names/phones |
| GET | `/bookings/slots?date=` | Guest | Free hours for a date (today..+10 days, Nepal time) -> `{date,slots:[{hour,startTime,endTime,price}]}` |
| POST | `/bookings/quote` | Guest | `{date,startTime,duration?,promoCode?,voucherId?}` -> `{basePrice,discount,total,promo,usesVoucher,earnPoints}` |
| POST | `/bookings/checkout` | Guest or User | `{date,startTime,duration?,method: fonepay|venue,promoCode?,voucherId?,guest?:{name,phone}}`. Guest: details required, `venue` refused (403), no voucher. User: no guest details. Window today..+10. Online -> `{booking, payment:{orderCode,amount,remarks,qrPayload,expiresAt}}` and the slot is held 10 minutes |
| GET | `/bookings/me` | User | my bookings (membership ledger rows hidden) |
| GET | `/bookings/me/rebook` | User | usual weekday+hour and the next open date, or `null` |
| GET | `/bookings/:id` | Owner/Staff | |
| POST | `/bookings/:id/cancel` | Owner | keeps the record; frees the slot; returns a used voucher |
| POST | `/bookings/:id/arrival` | Owner | "I'm coming": from 1 hour before to 30 minutes after the start |
| GET | `/bookings/arrivals` | Staff | who is on the way |
| GET | `/payments/:orderCode/status` | Owner, or guest with `?phone=` | `pending|paid|expired`. Only the gateway/staff change it |
| POST | `/payments/:orderCode/mark-paid` | Staff | |
| POST | `/payments/:orderCode/test-pay` | local/test only | simulates the gateway |
| POST | `/payments/webhooks/fonepay` | gateway | 501 until configured; must verify the gateway signature |

`startTime` is `HH:mm`. A booking made with a voucher costs Rs. 0, is confirmed at once, and uses up the voucher.

## Promos, loyalty

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/promos` | Guest | `code,title,description,discount,kind,until,daysLeft,terms,status` |
| POST | `/promos/validate` | Guest | `{code,date,startTime}` |
| GET | `/loyalty/me` | User | `remaining, earned, claimed, expired, expiringSoon, byType, rows[], shifts[{period,price,perGame,cost,canClaim}], vouchers[], toNext` |
| POST | `/loyalty/claim` | User | `{period: Morning|Day|Evening}` -> voucher. 409 if not enough points. Locked so a double tap cannot spend twice |
| POST | `/loyalty/goods-sale` | Staff | `{phone, amount, items?}`: 1 point per Rs. 100 |

Rules (single source: `src/utils/loyaltyPoints.ts`): a completed and paid regular game earns price/100 points (1 decimal);
a free game costs price/10; goods Rs. 100 = 1 point; membership 3 months 30 / 6 months 70; challenge win 5 (winning captain only).
Game and challenge points last 3 months, goods 1 year, membership never; claims spend the soonest-expiring points first.
Awards are idempotent per source. Free-game bookings, guests, membership ledger rows and challenge bookings earn no game points.

## Gamezone

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/gamezone/catalog` | Guest | consoles, games, plans, rules |
| GET | `/gamezone/slots?date=&hours=&consoleId=` | Guest | free start hours for that console |
| POST | `/gamezone/bookings` | Guest or User | `{date,hour,hours,players(1/2/4),consoleId,game,method,guest?}`; total = rate x players x hours (server) |
| GET | `/gamezone/bookings/me` | User | |
| POST | `/gamezone/bookings/:code/cancel` | Owner | before the session starts |
| POST | `/gamezone/bookings/:code/arrival` | Owner | check-in window like court bookings |
| GET/POST | `/gamezone/admin/bookings`, `/admin/bookings/:code/mark-paid` | Staff | |
| POST/PATCH/PUT | `/gamezone/admin/games|consoles|plans` | Staff | manage the catalog and rates |

## Captain mode

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/teams` | User in Captain mode | `{name 2-30}` |
| GET | `/teams/me` | User | roster (with phones) for my own team |
| POST/DELETE | `/teams/me/members`, `/teams/me/members/:userId` | Captain | add by phone (registered, in no other team, max 12); the captain cannot be removed |
| GET | `/teams/ranking`, `/teams/:id` | Captain | rating (1-5, needs 3 approved games), rank, record, form. Team stats only |
| GET/POST | `/challenges` | Captain | create needs >= 5 players, `loserPct` 70/60/100 with no default, date within 10 days |
| POST | `/challenges/:id/accept|decline|cancel` | Captain | accept creates the court booking (the unique hour guard decides races) |
| POST | `/challenges/:id/result` | Winning captain | `{myScore, theirScore}` overall score only, 0-50, after the game starts |
| POST | `/results/:id/approve|dispute` | The other captain | approve updates records and awards 5 points to the winner |
| GET | `/challenges/pending`, `/challenges/prompts/did-you-win`; POST `/challenges/:id/prompt-shown` | Captain | tile badge and "Did you win?" |
| POST | `/teams/admin/challenges/:id/venue-paid` | Staff | prompts both captains |
| POST | `/teams/admin/results/:id/resolve` | Staff | `{action: approve|void, scoreSubmitter?, scoreOther?, note?}` |
| GET | `/teams/admin/settlements?date=` | Staff | who owes what at the venue |

## Membership (existing customers, no extra sign-up)

Each subscription has a `memberCode` (MEM-10001...), the Membership ID shown to the member; staff create it in the admin portal when the membership is made (migration `20261014000001_member_code`, nullable and unique). Subscriptions made before this have none until staff renew or verify them. The admin portal also creates, verifies, renews, extends, suspends and cancels memberships (`suspended` and `cancelled` free the hour); the customer app keeps blocking the hour of `active` and `pending` memberships.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/membership/offers` | Guest | active plans with `prices[1_month|3_months][morning|day|evening]` after the plan discount (`null` = not offered) |
| GET | `/membership/mine` | User | `{current, history}` |
| POST | `/membership/request` | User | `{planId, timeSlot "07:00-08:00", duration, startDate}`; price is computed on the server; creates a PENDING subscription; staff verify the payment (`/membership/subscriptions/verify-payment`) to activate it. 4 PM - 8 PM is never offered |

Bookings now carry a short display `code` ("UF-7K3QX9", `scripts/backfill-booking-codes.ts` fills older ones). Cancelling a booking or a Gamezone session is free until it starts; a paid online order becomes `refunded` with a `REFUND_DUE` payment event for staff, and the response has `refundDue`.

## Other

| Method | Path | Who | Notes |
|---|---|---|---|
| GET/POST/DELETE | `/notifications`, `/notifications/read`, `/notifications/:id/read` | User | unread counts per type for the Popular tile badges |
| GET | `/tournaments/current` | Guest | current tournament and tie-sheet |
| PUT | `/tournaments/:id/tiesheet` | Staff | save rounds and matches IN PLACE: a match keeps its row (and its followers) when its `id` is sent back, or, when a round sends no ids, by its order in the round; matches left out are removed. Followers get a notice (type `tournament`) at kick-off, on every goal of a live match and at full time |
| GET | `/tournaments/following` | User | ids of the unfinished matches I follow |
| PUT, DELETE | `/tournaments/matches/:id/follow` | User | follow or stop following a match (404 unknown, 409 finished, max 20); table `MatchFollow` (migration `20261017000001_match_follow`, deleted with the match) |
| GET | `/tournaments`, `/tournaments/:id` | Guest | safe summary; staff get everything |
| GET/PATCH | `/site` | Guest / Staff | contact details |

## Background jobs (`src/tasks/cron.ts`, `src/jobs/app.jobs.ts`)

Every minute: expire unpaid QR holds and free the slot. Every 10 minutes: 1-hour reminders (bell) and close unanswered
challenges. Daily 09:00: warn about loyalty points expiring within 30 days. The developer's jobs (auto-complete, SMS reminders,
membership expiry SMS, daily report) still run.

## Courts

The developer's system has one pool of hours (no separate Court 1 / Court 2). The frontend demo showed two courts. If the
venue really has two courts, add a `courtId` to `BookingSlot` and the checkout (a small, additive change). Until then each hour
can be booked once.

## Complaints

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/complaints/categories` | Guest | `{categories[{id,label}], messageMin, messageMax, maxPhotos, perDay}` |
| POST | `/complaints` | User | `{category, message (10-1500), bookingCode?, photos?: [image data URLs, max 3]}` -> complaint with code `CP-XXXXXX`. `bookingCode` must be on the caller's own account (400). 5 per 24 hours (429). Photos: JPG/PNG/WebP, 8 MB each before compression; decoded and re-encoded server-side, saved as JPEG |
| GET | `/complaints/me` | User | own complaints, newest first, with `status`, `staffReply`, `photos` (paths under `/uploads/complaints/...` or full R2 URLs) |
| GET | `/complaints/admin?status=&page=&limit=` | Staff | all complaints with `userId` and `customerName` |
| PATCH | `/complaints/admin/:id` | Staff | `{status?: open|in_review|resolved|closed, reply?}`; notifies the customer (`type: "complaint"`); audited |

Table `Complaint` (migration `20261007000001_complaints`, additive). Notification type `complaint` added.

## Children's Academy (ages 10 to 14)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/academy/info` | Guest | `{minAge, maxAge, perDay, terms{version,text,updatedAt}, sessions[{id,title,date,startTime,endTime,coach,capacity,seatsLeft}]}`. Only classes staff made visible, open and not yet started |
| POST | `/academy/enroll` | User | `{guardianName, guardianPhone, emergencyPhone, address, childName, childAge (10-14), healthStatus: healthy|condition, healthNotes (required for condition), sessionId, acceptTerms: true, termsVersion}` -> enrolment with code `AC-XXXXXX`. 400 bad fields, 404 class not available, 409 started / full / duplicate child / terms changed, 429 more than 5 a day. Capacity is checked under a row lock. Re-enrolling after cancelling reuses the row |
| GET | `/academy/mine` | User | own enrolments, newest first, with `canCancel` |
| POST | `/academy/enrollments/:id/cancel` | User | owner only, before the class starts |

Tables `AcademySession`, `AcademyEnrollment` (migration `20261010000001_children_academy`, additive). Terms live in `Settings` key `academyTerms` (`{version,text,updatedAt}`, edited from the admin portal; each edit raises the version). Notification type `academy` added. Staff manage classes, attendance and terms in the admin portal.

## Refer & Earn

A customer books a game for ANOTHER team on their own account, then files it here with that team's captain. Staff approve it in the admin portal, which writes the loyalty points (kind `referral`, valid 12 months) for BOTH people. The app never writes points.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/refer/rules` | Guest | `{enabled, referrerPoints, friendPoints, perDay}` (staff set the points in `Settings` key `referEarn`) |
| GET | `/refer/me` | User | `{rules, referrals[] (as referrer or as friend; `points` is what the caller gets), eligibleBookings[]}` (own, not cancelled, regular, last 30 days, not already sent) |
| POST | `/refer` | User | `{bookingCode, friendPhone, teamName}` -> referral `RF-XXXXXX`, pending. 404 booking not yours or friend not registered, 400 yourself / bad fields, 409 cancelled, too old or already referred, 403 paused, 429 over 5 a day. Friend is notified (`type: "referral"`) |
| POST | `/refer/book` | User | `{date, startTime "HH:00", friendPhone, friendName}`: one step. Reserves the slot on the caller's account (1 hour, pay at the venue, 10-day window) and files the referral for it; if filing fails (friend not registered, over 5 a day, ...) the reservation is cancelled again and the slot freed. Same errors as `POST /refer` plus 400 for a bad date/time |
| DELETE | `/refer/:id` | User | withdraw while pending (referrer only) |

Table `Referral` (migration `20261011000001_refer_earn`, additive; one referral per booking). Notification type `referral` added.

## Digital ID (customer QR)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/me/digital-id` | User | `{name, phone, payload "UFID1.<random 192-bit token>", createdAt, replacedAt}`; made on first use. The QR holds only the token, no personal data; only staff in the admin portal can resolve it |
| POST | `/me/digital-id/replace` | User | new token, the old QR stops working |

Table `DigitalId` (migration `20261015000001_digital_id`, additive). The admin portal has the same table (its `sql/015`) and the staff scan endpoints (see its `docs/API.md`).

## Venue Wi-Fi

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/wifi` | User | `{visible:false}` when staff switched it off or set no name. By default (`wifiAccess` not `all`) a customer with no confirmed game, Gamezone session or active membership slot from 60 minutes before to 30 minutes after now gets `{visible:true, locked:true, message}` and NOTHING secret. Otherwise `{visible:true, locked:false, ssid, password, open, qr}` where `qr` is the standard `WIFI:T:WPA;S:..;P:..;;` text (special characters escaped). Never cached. Guests get 401 |

Staff set `wifiSSID`, `wifiPassword`, `wifiVisible` and `wifiAccess` (`booked` default or `all`) (Settings keys) in the admin portal. The public `GET /settings` no longer returns the Wi-Fi name or password.

## Site content (gallery and ads)

Staff upload photos and ads in the admin portal (Site Content). The app reads them here; no sign-in needed. The server decides what is live (Nepal time), so a time-targeted ad appears and disappears by itself.

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/content/active` | Guest | `{gallery[{id,title,caption,orientation: landscape|portrait|square,imageUrl}], ads: {header[], footer[], popup[], inline[]}}`; each ad has `{id,title,imageUrl,linkUrl,displaySeconds}`, pop-ups also `popupDelaySeconds` and `popupFrequency` (session|day|always). Only visible photos and ads that are live right now: active, inside the date range, on a chosen weekday, inside the daily hours window (a window may pass midnight) |
| GET | `/content/media/:id` | Guest | the picture (stored in the database as a 1600px JPEG), cached for a year |
| POST | `/content/ads/:id/view`, `/click` | Guest | counters for the venue's reports; only counted while the ad is live; always 204 |

| POST | `/content/visit` | Guest | body `{visitor}` (random id from the browser, 16-64 chars of A-Z a-z 0-9 _ -); counts one visitor per Nepal day and their page views for the admin Overview; no personal data kept; always 204 |

Tables `SiteVisit` (migration `20261016000001_site_visits`), `ContentMedia`, `SiteGallery`, `SiteAd` (migration `20261012000001_site_content`, additive; the older `Ad` and `Gallery` tables and `/ads` routes are left as they were).

## VIP discount code

Staff (admin portal > Customers) give one customer a VIP code such as `ADMINVIP`: `VipCode` (migration `20261009000001_vip_codes`, additive, one per customer), `type` percent or flat, `value`, `active`, `claimedAt`.
- The customer types the code in the booking promo box (`POST /bookings/quote`, `POST /promos/validate`, `POST /bookings/checkout`). Quoting with it marks it **claimed** (`claimedAt`). The response has `promo: {ok:true, code:"ADMINVIP", label:"VIP 10% off"}` and `vip: {code, label}`.
- Once claimed, it applies to **every later booking with nothing typed** (`vip` is set, `promo` stays null). A paused (`active:false`) or removed code stops at once.
- If a normal promo code is typed too, the bigger discount wins and `promo` names the one applied. A wrong code still reports "invalid" while the VIP discount keeps applying.
- Only the customer it was given to can use it. Anyone else (another customer, a guest) typing the same text gets "This promo code is invalid."
- The booking stores the code in `promoCode` and the amount in `discountAmount`, so staff can see how much it has saved.
