# Unique Futsal: Backend Requirements Document

Derived from an audit of the finished frontend (Next.js App Router PWA) at commit time of this document.
**Scope: requirements only. No backend is built. The frontend was not modified.**

Everything the app shows today is demo data in `lib/*` or browser storage. The files named in each section are the
code the backend must replace. Business rules marked **[SERVER]** are currently decided in the browser and **must**
be re-implemented and enforced on the server, because the browser can never be trusted.

---

## 0. Decisions needed before building

| # | Decision | Why it matters |
|---|---|---|
| D1 | Reuse the developer's existing production backend and database, or build a new one? | The old API (`NEXT_PUBLIC_API_URL`, tag `legacy-original`) holds real customers, bookings and inventory. A new schema needs a migration plan; never point development at production data. |
| D2 | How do customers log in: phone + OTP (SMS), phone + password, or both? | The frontend has **no login screen** (only a demo "Sign in" button). Needs a login/register UI plus endpoints. The mobile number is the natural identity (teams add players by mobile number). |
| D3 | Payment gateway integration: eSewa and Fonepay merchant accounts, API type (dynamic QR vs redirect), callback URLs. | Real QR codes can only be created by the server. Payment status must come from the gateway, never the browser. |
| D4 | SMS provider (OTP, reminders) and Web Push (VAPID) hosting. | OTP login, "Booking reminders (SMS)" switch, closed-app reminders. |
| D5 | Real prices, court count, Gamezone console count, opening hours, cancellation/refund policy. | The frontend uses demo values (see section 5). |
| D6 | Loyalty expiry model: per-earning rolling expiry (as built) or a cycle starting at the first game. | See section 6.8. |
| D7 | Is the admin panel built by you or the developer, and which admin roles exist (owner, staff/cashier)? | Many flows end in an admin action (section 7). |

---

## 1. Frontend audit

### 1.1 Routes and screens

| Route | Screen | Auth | Data it needs from the backend |
|---|---|---|---|
| `/` | Home: company header, greeting, bell, Nepali date + weather, search (non-functional), Quick Rebook, banner, Popular tiles (with badges), live promo codes, tournament scores + tie-sheet, footer, WhatsApp help button | Public; personalised parts need session | session, notifications (badges), promo list, tournament, booking history (Quick Rebook), team pending actions, site contact info |
| `/book` (`?date=&hour=`) | Court booking: 11-day date strip, available slots by period, review, promo, guest details, payment, QR, confirmation | Public (guest or registered) | slots, price, promo validation, create booking, payment order/status, loyalty voucher |
| `/gamezone` | PS5 booking: players, hours, console, game, date, start time, review, pay | Public | gamezone catalog, per-console availability, create booking, payment |
| `/member` | Membership: current plan card, plans, billing toggle, review + promo, payment, renewal | Registered (guests see a details form but cannot buy a membership as guest in the demo; see 6.7) | plans, my membership, validate promo, purchase/renew |
| `/points` | Loyalty: balance, claim free game, rules, expiry, history | Registered | ledger, summary, vouchers, claim |
| `/promos` | Promos: Active / Upcoming / Expired | Public | promo list |
| `/profile` | Profile: details edit, membership card, loyalty card, My bookings (next + last), Gameplay stats, Payment history, PDFs, Settings, Player/Captain switch, sign out | Registered | profile, bookings, stats, payments, prefs, mode |
| `/opponent` (`?report=<challengeId>`) | Teams leaderboard, Challenges, Results (score upload/approve) | Registered + Captain mode | teams ranking, challenges, results |
| `/opponent/team/[id]` | Another team's stats (rating, rank, record, form) | Registered captain | team stats |
| `/team` | My roster: add by mobile number, remove | Registered captain | team, members |
| `/tournaments` | Tournament details, prizes, rounds, scores | Public | tournament |
| `/help` | Help topics + search + call/WhatsApp | Public | static (optionally CMS) |
| `/offline` | PWA offline page | Public | none |
| `/icons/192`, `/icons/512`, apple icon, `manifest.webmanifest`, `sw.js` | PWA assets and service worker (push handlers exist) | Public | none |

Global components that run on every page: `CompanyHeader`, `BottomNav`, `FooterGate`, `InstallPrompt`, `ReminderScheduler`,
`ArrivalPrompt` ("I'm coming" full-screen slider), `ExpiryPrompt` (membership renewal pop-up), `WinPrompt` ("Did you win?"), `SwRegister`.

### 1.2 Every form and input

| Form | Fields | Frontend validation (re-implement on server) |
|---|---|---|
| Guest booking / membership / gamezone details | name, mobile | name length >= 2; mobile `^9\d{9}$` (10 digits starting with 9) |
| Booking promo code | code | non-empty; uppercased; trimmed |
| Membership promo code | code | same |
| Profile edit | name, mobile, email, location, preferred position | name >= 2 chars; mobile `^9\d{9}$`; email is `type=email` only; position from fixed list; **not saved anywhere today** |
| Settings | language (en and others), Pop-up reminder, Booking reminders (SMS), Promotional notifications | booleans; language is a dropdown that does nothing yet |
| Create team | team name | 2 to 30 chars |
| Add player | mobile | `^9\d{9}$`; must be a registered player; not already in any team; team < 12 |
| Challenge | team, type (`match`/`competition`), date, hour, who pays (70/60/100), message | must be Captain with >= 5 players; no self-challenge; no duplicate pending challenge to the same team; date today..today+10; loser share in {70,60,100} with **no default**; message <= 140 chars |
| Result upload | my score, their score | integers 0 to 50; **only the winning captain uploads** (my score >= their score); one active result per challenge |
| Search box and filter button on Home | free text | **non-functional placeholders** |
| Help search | free text | client-side only |
| Gamezone | players (1/2/4), hours (1 to 4), console, game, date, start time | all required; game must be in catalog |
| Booking | date (today..+10), slot, court, promo, payment method | see 6.3 |

### 1.3 Every button and user action (grouped)

- **Booking:** select date / slot / court, apply promo, continue, choose payment method, reserve/pay, back to change, add to calendar (.ics generated client-side), view my bookings, "Use a free game voucher".
- **Payment QR:** shows QR, countdown (10 min), copy details, download QR (client), auto-polls status every 3 s, demo "simulate payment" (remove).
- **Quick Rebook:** "Book again" (deep link `/book?date=&hour=`), shown only when slot is open.
- **Membership:** billing toggle, choose plan, apply promo, pay, renewal pop-up (Renew / Later).
- **Loyalty:** claim free game per shift (confirm), show all history.
- **Profile:** edit/save profile, cancel booking (confirm), expand lists, Download PDF (bookings, games, payments), toggles, sign out, Player/Captain switch.
- **Captain:** create team, add/remove player, challenge, accept/decline/cancel challenge, upload result, approve/dispute result, "Update score" (from Did-you-win popup).
- **Notifications:** open bell, mark read, mark all read, clear all, enable system notifications.
- **Arrival:** slide "I'm coming", "Remind me in 10 minutes", Done.
- **Help/support:** WhatsApp topics (`wa.me` links), call, help topics.
- **Install:** install prompt (Android) / instructions (iOS).

### 1.4 Network calls that exist today

Only one: the browser calls `https://api.open-meteo.com` for the header temperature (Tilottama coordinates). The Nepali (BS) date is computed locally with `nepali-date-converter`. **There are no calls to any backend.** Optional: proxy weather through the server to cache it and avoid exposing a third party.

### 1.5 Browser storage inventory (all must move to the server unless noted)

| Key | File | Content | Becomes |
|---|---|---|---|
| `uf-session-v1` | `lib/session.ts` | demo signed-in/guest flag | real auth session (HTTP-only cookie) |
| `uf-notifications-v1` | `lib/notifications.ts` | notice list (max 50) | `notifications` table |
| `uf-reminders-v1` | `lib/notifications.ts` | upcoming game reminders | server job off `bookings` |
| `uf-arrival-v1` | `lib/arrival.ts` | "I'm coming" + snooze state | `arrival_checkins` |
| `uf-prefs-v1` | `lib/prefs.ts` | reminders, promos, popup switches | `user_prefs` |
| `uf-teams-v1` | `lib/teams.ts` | mode, my team, challenges, results, stat overlays | teams/challenges/results tables |
| `uf-points-v4` | `lib/points.ts` | ledger + vouchers | `loyalty_ledger`, `free_game_vouchers` |
| `uf-winprompt-v1` | `components/captain/WinPrompt.tsx` | prompts already shown | `challenge_prompts` (or keep client-side) |
| `uf-expiry-dismissed-v1` | `components/ExpiryPrompt.tsx` | renewal pop-up dismissed today | optional server flag; client is fine |
| `uf-install-dismissed` | `components/InstallPrompt.tsx` | install prompt dismissed | stays client-side |
| `uf-demo-paid-<orderId>` | `lib/payment.ts` | demo "paid" flag | delete; replaced by gateway callback |

### 1.6 Mock / static / placeholder data to replace

`lib/sample-profile.ts` (customer, membership, bookings, stats, matches, booking history), `lib/sample-data.ts` (tournament + tie-sheet),
`lib/promos.ts` (promo list), `lib/booking.ts` (courts, `priceFor`, pseudo-random availability `isTaken`, `PROMOS`), `lib/membership.ts` (`PLANS`, `MEMBER_PROMOS`, `sampleCurrent`),
`lib/gamezone.ts` (consoles, games, plans, pseudo-random availability), `lib/teams.ts` (`SAMPLE_TEAMS`, `FREE_AGENTS`, demo opponent buttons, `createTeam` seeding demo activity),
`lib/points.ts` (`SEED` ledger), `lib/notifications.ts` (`SEED_DEMO` notices), `lib/payment.ts` (`demoQrPayload`, `DEMO_PAYMENTS`, `demoSimulatePayment`),
`lib/site.ts` (contact info, social links empty), `lib/help.ts` (static text), `lib/session.ts` (demo user).

### 1.7 Business rules currently in the frontend and their server home

Section 6 lists every rule with its values. Main ones: 10-day booking window, one-hour slots, 2 courts, 3 price tiers, guest must pay online in full, promo validation, QR hold 10 min, membership date maths and promo rules, loyalty earning/expiry/claim, captain eligibility, 12-member cap, loser-pays settlement, 5-star rating, result approval flow, Quick Rebook detection, reminders 1 hour before.

---

## 2. Conventions

- REST over HTTPS, JSON, prefix `/api/v1`. Times in **Asia/Kathmandu**; store UTC timestamps, dates as `YYYY-MM-DD`, hours as integers 0 to 23.
- **Money**: integer NPR (no decimals). **Points**: one decimal (`NUMERIC(8,1)`).
- **Auth**: HTTP-only secure session cookie (or short-lived JWT + refresh). `registered` = valid session. Roles: `customer`, `staff`, `admin`. Public endpoints are marked `Public`; guest-capable endpoints accept no session but need contact details.
- **Identity always comes from the session**, never from the request body (customer id, name, phone).
- **Idempotency**: payment callbacks and any create endpoint that charges accept an `Idempotency-Key` header.
- **Errors**: `{ "error": { "code": "SLOT_TAKEN", "message": "..." } }` with 400/401/403/404/409/422/429. 409 for conflicts (double booking, duplicate), 422 for validation.
- **IDs the UI displays**: bookings `UF-YYYYMMDD-NNNNN`, gamezone `UF-GZ-YYYYMMDD-NNNNN`, membership `MEM-NNNNN`, customer `UF-C-NNNNN`. Generate server-side, unique.
- Pagination `?limit=&cursor=` on lists that grow (bookings, payments, ledger, notifications).
- Rate-limit OTP, promo validation, add-player lookup and login.

---

## 3. Data model (tables / entities)

Relationships in brackets. All tables have `id`, `created_at`, `updated_at` unless stated.

**Identity**
- `users` (customer_code UK, phone UK, name, email NULL, location, preferred_position, status `active|suspended`, role, language, registered_at, password_hash NULL)
- `user_prefs` (user_id PK -> users, sms_reminders, promo_notifications, popup_reminder)
- `otp_codes` (phone, code_hash, expires_at, attempts, consumed_at) *if OTP login*
- `sessions` / `refresh_tokens` (user_id, token_hash, device, expires_at)
- `push_subscriptions` (user_id, endpoint UK, p256dh, auth, user_agent)

**Courts and bookings**
- `courts` (name, active)
- `price_rules` (shift `Morning|Day|Evening`, start_hour, end_hour, price_npr, valid_from, valid_to NULL) *(Morning < 10:00, Day 10:00 to 17:00, Evening 17:00 onwards today)*
- `slot_blocks` (court_id -> courts, date, start_hour, end_hour, reason, created_by) *maintenance, tournaments, private use*
- `bookings` (code UK, user_id -> users NULL for guests, guest_name, guest_phone, court_id, date, start_hour, duration_hours=1, base_price, discount, total, promo_code_id NULL, payment_method `esewa|fonepay|venue`, payment_status `pending|paid|pay_at_venue|refunded|expired`, status `confirmed|completed|cancelled|no_show|expired`, source `regular|challenge`, challenge_id NULL, voucher_id NULL, cancelled_at, cancel_reason, refund_amount, checked_in_at, completed_at). **Unique** (court_id, date, start_hour) where status in (`confirmed`, `pending hold`).
- `booking_holds` (booking_id, expires_at) *slot is held while the QR is open, 10 min*

**Payments**
- `payments` (order_code UK = booking/membership/gamezone code, purpose `game|gamezone|purchase|renew`, ref_type, ref_id, user_id NULL, method, amount, status `pending|paid|expired|failed|refunded`, remarks, qr_payload, gateway_ref NULL, expires_at, paid_at, paid_by_staff_id NULL for venue payments)
- `payment_events` (payment_id, source `gateway|staff`, raw_payload, received_at) *append-only audit of callbacks*
- `refunds` (payment_id, amount, reason, status, processed_by)

**Promos**
- `promo_codes` (code UK, title, description, terms, kind `booking|membership`, discount_type `percent|flat`, value, valid_from, valid_until, rules JSON {weekdays[], hour_before, shifts[], renew_only}, max_uses NULL, per_user_limit NULL, active)
- `promo_redemptions` (promo_code_id, user_id NULL, ref_type, ref_id, discount_applied)

**Membership**
- `membership_plans` (code, name, tagline, price_monthly, price_quarterly, price_half, monthly_allowance, benefits JSON, popular, active)
- `memberships` (code UK, user_id, plan_id, billing `monthly|quarterly|half`, start_date, end_date, paid_amount, status `pending|active|expired|suspended|cancelled`, payment_id, renews_membership_id NULL, used_this_month)

**Loyalty**
- `loyalty_ledger` (user_id, kind `game|captain_win|goods|membership|free_game`, points signed NUMERIC(8,1), earned_on DATE, expires_on DATE NULL (NULL = never), source_type, source_id, detail). **Unique (kind, source_type, source_id)** for idempotent awards.
- `loyalty_lot_usage` (claim_ledger_id, earn_ledger_id, points) *which earnings a claim consumed (soonest-expiry first)*
- `free_game_vouchers` (user_id, period `Morning|Day|Evening`, cost, status `unused|used|void`, ledger_id, booking_id NULL, claimed_at, used_at)
- `goods_sales` (user_id NULL, amount, items JSON, sold_by_staff_id, sold_at) *needed to award goods points*

**Teams and challenges**
- `teams` (name, area, captain_user_id UK -> users, active)
- `team_members` (team_id, user_id UK -> users *one team per player*, position, joined_at) *max 12 incl. captain*
- `challenges` (code, challenger_team_id, challenged_team_id, type `match|competition`, date, start_hour, court_id, court_price, loser_pct `70|60|100`, message, status `pending|accepted|declined|cancelled|expired`, booking_id NULL, venue_paid_at NULL, venue_paid_by NULL)
- `challenge_results` (challenge_id, submitted_by_team_id, score_submitter, score_other, status `awaiting_approval|approved|disputed`, approved_by_user_id NULL, resolved_by_admin_id NULL, resolution_note)
- `team_stats` (team_id PK, played, wins, draws, losses, goals_for, goals_against, form CHAR(5) *or compute from results*) and a derived `rating` + `rank` (computed on read or by job)
- `challenge_prompts` (challenge_id, user_id, shown_at) *optional "Did you win?" once per captain*

**Gamezone**
- `gz_consoles` (name, active), `gz_games` (title, active), `gz_pricing` (players 1/2/4, rate_per_person_hour), `gz_blocks`
- `gz_bookings` (code UK, user_id NULL, guest_name, guest_phone, console_id, game_id, date, start_hour, hours 1..4, players, total, payment_method, payment_status, status). **Unique/overlap constraint** per console and hour range.

**Engagement**
- `notifications` (user_id, type `challenge|payment|booking|reminder|membership|match|promo|points|tournament|gamezone`, title, body, href, read_at NULL, dedupe_key UK)
- `reminder_jobs` (booking_id, remind_at, sent_at) *or computed by the scheduler*
- `arrival_checkins` (booking_id UK, user_id, confirmed_at, snoozed_until, alerted_admin_at)

**Content**
- `tournaments` (name, status `upcoming|live|completed`, start_date, end_date, venue, team_count, prize_pool, prize_1, prize_2, prize_3, format), `tournament_rounds` (tournament_id, name, position), `tournament_matches` (round_id, home_team_name/team_id NULL, away..., status `upcoming|live|finished`, home_score, away_score, note, starts_at, venue)
- `site_settings` (key/value: name, phone, whatsapp, email, address, facebook, tiktok, map embed, cancellation policy, opening hours)
- `help_topics` (optional CMS; today static in `lib/help.ts`)
- `admin_audit_log` (actor_id, action, entity, entity_id, before, after, ip) for every admin/staff mutation

---

## 4. API specification

Legend: **P** Public, **G** guest allowed (contact details in body), **U** registered user, **C** registered captain (Captain mode with team), **S** staff/admin, **A** admin only, **W** webhook (signature verified).

### 4.1 Authentication and session

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| POST | `/auth/otp/request` | P | `{phone}` | `204` | phone `^9\d{9}$`; rate limit (e.g. 3 per 10 min per phone/IP); creates the user on first verify |
| POST | `/auth/otp/verify` | P | `{phone, code, name?}` | `{user}` + session cookie | code valid 5 min, max 5 attempts; `name` required on first sign-up (>= 2 chars) |
| POST | `/auth/login` | P | `{phone, password}` | `{user}` + cookie | only if D2 chooses passwords |
| POST | `/auth/logout` | U | none | `204` | clears session |
| GET | `/auth/me` | P | none | `{registered:false}` or `{registered:true, id, customerCode, name, phone, role}` | replaces `useSession` in `lib/session.ts` |

Suspended users get 403 on every authenticated call.

### 4.2 Profile and preferences

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/me/profile` | U | none | `{customerCode,name,phone,email,location,position,registeredAt,status}` | |
| PATCH | `/me/profile` | U | `{name?,email?,location?,position?,phone?}` | updated profile | name >= 2; email valid; position in {GK,DEF,MID,FWD}; changing phone requires OTP re-verification and must stay unique |
| GET | `/me/preferences` | U | none | `{language,smsReminders,promoNotifications,popupReminder}` | defaults: true/true/true, language `en` |
| PUT | `/me/preferences` | U | partial of the above | updated | server must skip the "I'm coming" push when `popupReminder` is false |
| POST | `/me/push-subscriptions` | U | PushManager subscription JSON | `201` | upsert by endpoint |
| DELETE | `/me/push-subscriptions` | U | `{endpoint}` | `204` | |

### 4.3 Courts, slots and pricing

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/courts` | P | none | `[{id,name}]` | |
| GET | `/slots?date=YYYY-MM-DD` | P | `date` | `[{hour, period, status:available|almost|booked|past, freeCourts:[courtId], price}]` | date within today..today+10 (else 422); hours 6 to 21 (`OPEN_HOUR 6`, `CLOSE_HOUR 22`); past hours today are `past`; booked includes `slot_blocks` and active holds; `almost` = one of two courts left. **The UI lists only `available` and `almost`.** Price from `price_rules` |
| GET | `/pricing` | P | none | tiers | for display only |

### 4.4 Bookings

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| POST | `/bookings/quote` | G | `{date,hour,courtId,promoCode?,voucherId?}` | `{base,discount,total,promo:{ok,label,message},earnPoints}` | server recomputes price and promo; never trusts browser numbers |
| POST | `/bookings` | G | `{date,hour,courtId,method,promoCode?,voucherId?,guest?:{name,phone}}` | `{booking, payment?:{orderCode,qrPayload,expiresAt,amount,remarks}}` | in ONE transaction: re-check slot and window (<= 10 days), lock slot (`409 SLOT_TAKEN`), compute price/promo, apply voucher (total 0 -> `paid`, no payment). **Guest**: `guest.name` >= 2, mobile `^9\d{9}$`, `method` must be `esewa|fonepay` (`403 GUEST_MUST_PAY_ONLINE` otherwise). **Registered**: any method; identity from session. Online: create payment, hold slot 10 min. Venue: `payment_status = pay_at_venue` |
| GET | `/bookings/:code` | U (owner) or G with `?phone=` | none | booking | owner check |
| GET | `/me/bookings?scope=upcoming|past|all&limit=&cursor=` | U | none | `{items:[{code,date,time,court,amount,payment,status,upcoming}], next}` | sorting: upcoming ascending, past descending |
| POST | `/bookings/:code/cancel` | U (owner) | `{reason?}` | `{status, refundAmount}` | allowed only for future `confirmed` bookings; refund by the cancellation policy (D5), refund of voucher games returns the voucher; frees the slot |
| POST | `/bookings/:code/arrival` | U (owner) | none | `204` | "I'm coming": allowed from 1 hour before start until 30 min after; creates `arrival_checkins`, alerts admin (push/dashboard). Idempotent |
| POST | `/bookings/:code/arrival/snooze` | U (owner) | none | `{snoozeUntil}` | optional; +10 min (can stay client-side) |
| GET | `/me/payments?limit=&cursor=` | U | none | payment history | excludes pay-at-venue until marked paid |
| GET | `/me/exports/:kind` (`bookings|games|payments`) | U | none | PDF stream or data | PDF must come from the **complete** history, not the page loaded |
| GET | `/me/gameplay/stats` | U | none | `{played,wins,losses,draws,goals,assists,lastGame, games:[...]}` | **source undefined**: see open question Q4 (personal stats vs team stats) |
| GET | `/me/rebook` | U | none | `{usual:{weekday,hour,count,total}, target:{date,available,price}}` or `null` | replaces `lib/rebook.ts`: from the last 12 bookings, need >= 2 in the same weekday+hour, most frequent, ties to most recent; target is the next such date within 10 days whose slot is open |

Booking states: `hold -> confirmed -> completed`, or `hold -> expired`, `confirmed -> cancelled`, `confirmed -> no_show`. A booking with online payment is only `confirmed` after the payment is `paid`.

### 4.5 Payments

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/payments/:orderCode/status` | G (order owner/phone) or U | none | `{status:pending|paid|expired|failed, paidAt?}` | polled every 3 s by `PaymentQr`; **status comes only from the gateway callback/verify API, never the browser**; return `expired` after 10 min |
| POST | `/webhooks/esewa` | W | gateway payload | `200` | verify signature/amount/reference; idempotent; mark payment `paid`, then confirm booking / activate membership / confirm gamezone, award notifications |
| POST | `/webhooks/fonepay` | W | gateway payload | `200` | same |
| POST | `/admin/payments/:orderCode/mark-paid` | S | `{method, note?}` | `{payment}` | pay-at-venue collection; records staff id; triggers booking confirm, membership activation, and for challenge games the "Did you win?" prompts |
| POST | `/admin/payments/:orderCode/refund` | A | `{amount, reason}` | refund | |

The QR payload returned must be the **gateway's real QR** for the exact amount and the remarks `"<Purpose> - <order code>"` (Regular game / Gamezone PS5 / Membership purchase / Membership renew). Unpaid orders expire after `QR_HOLD_MS = 10 min` and release the slot (job).

### 4.6 Promo codes

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/promos` | P | none | `[{code,title,discount,description,terms,kind,from,until,status}]` | status derived from today (active/upcoming/expired); the UI shows all three tabs |
| POST | `/promos/validate` | G | `{code, kind:'booking'|'membership', context:{date,hour,base}|{planId,billing,renewing}}` | `{ok,code,discount,label}` or `{ok:false,message}` | rules today: `DASHAIN83` 15% any slot until 2026-10-16; `WEEKEND10` 10% Sat/Sun games until 2026-10-31; `EARLY200` Rs. 200 off slots before 8 AM until 2026-11-30; `MEMBER10` 10% any plan until 2026-12-31; `RENEW200` Rs. 200 renewals only until 2026-12-31. Messages: "This promo code is invalid.", "This promotional code has expired.", rule-specific text. Percent rounds to whole rupees; flat discount capped at the base; one code per order |

Admin: CRUD on `promo_codes` (`/admin/promos`).

### 4.7 Membership

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/membership/plans` | P | none | plans with prices for monthly/quarterly/half, benefits, allowance, savings | today: Basic Rs. 1,500 / 4,200 / 8,000; Premium Rs. 3,000 / 8,400 / 16,000 |
| GET | `/me/membership` | U | none | `{membership|null, pending?:membership}` + derived `status`: Pending, Suspended, Expired, Expiring soon (<= 15 days), Active; `daysLeft` | |
| POST | `/memberships` | U | `{planId,billing,method,promoCode?}` | `{membership(pending), payment?}` | **registered only** (guests have no membership). Renewal = same plan with an unexpired membership: new period starts the day after the current end; anything else starts today. End = start + months - 1 day (month-end safe). Promo re-validated server-side (`RENEW200` renewals only). Activates only after payment `paid` (online via webhook, venue via staff). A pending purchase must never replace an active plan |
| GET | `/me/membership/notice` | U | none | `{show:boolean, daysLeft, membershipId}` | 3-month and 6-month plans only, within 15 days of the end, not pending/suspended; frontend dismisses per day |

Jobs: nightly status refresh, expiry notices (push + bell) 15 days before, monthly reset of `used_this_month`. Member pricing on court bookings and the monthly allowance (4 or 8 games) are shown as benefits but **not applied anywhere in the frontend**: needs a rule (Q5).

### 4.8 Loyalty points

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/me/loyalty` | U | none | `{summary:{earned,claimed,expired,remaining,expiringSoon:{points,date}|null,byType:{games,goods,membership:{points,nextExpiry}},toNext}, shifts:[{period,price,perGame,cost,canClaim}], vouchers:[...] }` | see 6.8 |
| GET | `/me/loyalty/ledger?limit=&cursor=` | U | none | entries with `validUntil`, `status: valid|used|expired|never` | |
| POST | `/me/loyalty/claim` | U | `{period}` | `{voucher}` | in a transaction: remaining valid points >= cost (price/10 of that shift), spend soonest-expiring first, write a negative ledger entry and a voucher; `409 NOT_ENOUGH_POINTS` |
| (internal) | award on events | server | | | game completed + paid: price/100 (1 decimal); goods sale: floor(amount/100); membership paid: 3 months 30, 6 months 70 (monthly none); challenge approved: 5 to the winning captain only. All idempotent per source id; free-game bookings earn none; registered account holder only |

### 4.9 Teams, challenges, results (Captain mode)

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| PUT | `/me/mode` | U | `{mode:'player'|'captain'}` | `{mode}` | any registered user may switch; guests cannot |
| GET | `/me/team` | U | none | `{team,members,stats,rating,rank}` or `null` | |
| POST | `/teams` | U | `{name}` | team | name 2 to 30; user not already in a team; user becomes captain and first member |
| POST | `/teams/me/members` | C | `{phone}` | member | `^9\d{9}$`; user must be registered; not already in any team; team size < 12; `404 PLAYER_NOT_FOUND` ("Ask them to sign up first."), `409 IN_OTHER_TEAM`, `409 ALREADY_MEMBER`, `409 TEAM_FULL`; notify the added player |
| DELETE | `/teams/me/members/:userId` | C | none | `204` | cannot remove the captain |
| GET | `/teams/ranking` | C | none | ranked teams `{id,name,area,players,record,rating,rank}` | rating only after >= 3 approved games (else "Unrated") |
| GET | `/teams/:id` | C | none | `{name,area,rating,rank,record,form,goalsFor,goalsAgainst}` | team stats only; **no individual player stats anywhere** |
| GET | `/challenges?box=in|out|all` | C | none | challenges with settlement preview | |
| POST | `/challenges` | C | `{teamId,type,date,hour,loserPct}` + `message?` | challenge | challenger team has >= 5 members; not own team; no duplicate pending to the same team; date today..+10; loserPct in {70,60,100}, required; court price for the hour from `price_rules`; notify the challenged captain (bell + push) |
| POST | `/challenges/:id/accept` | C (challenged) | `{courtId?}` | challenge + booking | in a transaction: pick a free court (**not chosen in the UI today**), create a `source=challenge` booking with `pay_at_venue`, `409 SLOT_TAKEN` if gone; notify the challenger |
| POST | `/challenges/:id/decline` | C (challenged) | none | challenge | |
| POST | `/challenges/:id/cancel` | C (challenger) | none | challenge | only while pending (or accepted before start per policy) |
| POST | `/challenges/:id/result` | C | `{myScore, theirScore}` | result | game accepted and started; integers 0 to 50; **only the winning captain may submit** (`myScore >= theirScore`; either side after a draw); one active (non-disputed) result per challenge; notify the other captain |
| POST | `/results/:id/approve` | C (other captain) | none | result | `awaiting_approval -> approved`; updates both teams' stats and ratings; awards 5 points to the winning captain; notify both |
| POST | `/results/:id/dispute` | C (other captain) | none | result | `-> disputed`; changes nothing; admin must resolve |
| GET | `/me/actions/pending` | C | none | `{challengesToAnswer, resultsToApprove}` | drives the Opponent tile badge; clears only when the captain acts |
| GET | `/me/prompts/did-you-win` | C | none | challenges where `venue_paid_at` is set, no result, not yet prompted | feeds `WinPrompt` |

Challenge pay split (**[SERVER]**): court price P, loser share L% -> loser pays round(P*L/100), winner pays the rest (always sums to P). Draw: 50/50 (assumption). Challenge games are **paid only at the venue after the game**; no online payment. When staff mark it paid the server sets `venue_paid_at` and notifies BOTH captains ("Did you win?" -> `/opponent?report=<id>`).

Rating (`teamRating`, compute server-side): needs >= 3 approved games; winRate=(W+0.5D)/N; gd=clamp((GF-GA)/N,-3,3), gdScore=(gd+3)/6; form = last 5 results (W=1, D=0.5, L=0); raw=0.55*winRate+0.25*gdScore+0.2*form; stable=(raw*N+0.5*5)/(N+5); stars=1+4*clamp((stable-0.2)/0.6, 0, 1), rounded to 1 decimal. Rank orders by rating, then games played, then goal difference.

### 4.10 Gamezone

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/gamezone/catalog` | P | none | `{consoles, games, plans:[{players,label,eachPerHour}], maxHours:4, openHour, closeHour}` | demo: PS5 Station 1 and 2; GTA 5, Forza Horizon, Red Dead Redemption, FIFA 26; Solo 300, 2 players 200 each, 4 players 150 each; hours 10 to 22 |
| GET | `/gamezone/slots?date=&hours=&consoleId=` | P | | `{hours:[startHour]}` | each console has its own bookings; a start is listed only if the console is free for every hour of the session; today's past times excluded; date window as 4.3 |
| POST | `/gamezone/bookings` | G | `{date,hour,hours,players,consoleId,gameId,method,guest?}` | `{booking,payment?}` | total = rate x players x hours (server computes); hours 1 to 4; players in {1,2,4}; guest rules and transactional slot lock as bookings; reminder 1 hour before |
| GET | `/me/gamezone/bookings` | U | | list | **not shown anywhere in the app yet** (Q6) |
| POST | `/gamezone/bookings/:code/cancel` | U | | | policy D5 |

### 4.11 Notifications and reminders

| Method | Path | Auth | Request | Response | Rules |
|---|---|---|---|---|---|
| GET | `/me/notifications?limit=&cursor=` | U | | `[{id,type,title,body,at,read,href}]` + `unreadByType` | the Popular tile badges count unread per type: Book (booking, reminder, payment), Membership, Points, Promos, Tournaments, Gamezone; Opponent uses `/me/actions/pending` |
| POST | `/me/notifications/:id/read` | U | | `204` | |
| POST | `/me/notifications/read` | U | `{types?:[...]}` or none = all | `204` | opening a tile marks its types read |
| DELETE | `/me/notifications` | U | | `204` | "Clear all" |

Server must create notices for: booking confirmed/created, payment received/pending/venue, 1-hour reminder, membership purchased/activated/renewed/expiring, challenge received/accepted/declined, result awaiting approval/approved/disputed, "Did you win?", points earned/expiring, tournament news, promos (respect the Promotional switch), gamezone events. Web Push: send the same events to stored subscriptions; the service worker already handles `push` and `notificationclick`. iPhone push only works for the installed home-screen app (iOS 16.4+). Closed-app 1-hour push + the full-screen "I'm coming" check-in is **deferred until the production DB exists**.

### 4.12 Tournaments

| Method | Path | Auth | Response | Notes |
|---|---|---|---|---|
| GET | `/tournaments/current` | P | tournament or `null` | `null` hides the Home section; includes rounds, matches, prizes, status; poll or SSE for live scores |
| GET | `/tournaments/:id` | P | full tie-sheet | |

### 4.13 Site content

`GET /site` (P) -> contact info (phone 9811940018, WhatsApp, email, address, Facebook/TikTok URLs currently empty, map). Optional `GET /help/topics` if help is moved to a CMS. WhatsApp help button only builds `wa.me` links from the phone number.

### 4.14 Admin / staff endpoints (admin panel is not built; these define what it must be able to do)

| Area | Endpoints (all S/A, all audited in `admin_audit_log`) |
|---|---|
| Bookings | `GET /admin/bookings?date=&status=&q=`, `POST /admin/bookings` (walk-in), `POST /admin/bookings/:code/cancel`, `POST /admin/bookings/:code/complete` (awards loyalty), `POST /admin/bookings/:code/no-show`, `GET /admin/arrivals` ("I'm coming" alerts, live) |
| Payments | mark paid at venue, refund, reconciliation list, failed callbacks |
| Courts/prices/slots | CRUD `courts`, `price_rules`, `slot_blocks` |
| Customers | search, view, suspend/unsuspend, edit |
| Membership | CRUD plans; list; mark venue payment paid (activates); suspend/extend |
| Promos | CRUD promo codes; usage report |
| Loyalty | record goods sale (awards points), manual adjustment (with reason), view ledger, void vouchers |
| Teams/challenges | list; **resolve disputed results** (approve/override/void); mark challenge game paid at venue (triggers "Did you win?") ; settlement list for staff showing who owes what |
| Gamezone | CRUD consoles, games, pricing; bookings; mark paid |
| Tournaments | CRUD tournaments, rounds, matches, live score updates |
| Notifications | broadcast promo/tournament notices |
| Reports | revenue by day/method, occupancy, no-shows, loyalty liability |

---

## 5. Business rules and constants (single source of truth)

| Rule | Value in the frontend today | File |
|---|---|---|
| Booking window | today to today + 10 days | `MAX_ADVANCE_DAYS`, `lib/booking.ts` |
| Slot length / hours | 1 hour; start 6:00 to 21:00 (last ends 22:00) | `OPEN_HOUR`, `CLOSE_HOUR` |
| Courts | Court 1, Court 2 | `COURTS` |
| Court price | Morning (before 10) Rs. 1,000; Day (10 to 17) Rs. 1,200; Evening (17+) Rs. 1,500 | `priceFor` (demo; owner quotes 1,250 / 1,150 / 1,350) |
| Slot status | `almost` when 1 of 2 courts is free | `getSlots` |
| Guest rule | name + valid mobile, pay 100% online; no venue payment, no membership, no history, no Quick Rebook | `BookingFlow`, `createBooking`, `purchaseMembership` |
| QR hold | 10 minutes; status polled every 3 s | `QR_HOLD_MS`, `PAYMENT_POLL_MS` |
| Payment methods | eSewa, Fonepay, Pay at venue | `lib/payment.ts` |
| Reminder | 1 hour before; full-screen check-in from 1 h before to 30 min after; snooze 10 min | `lib/arrival.ts`, `lib/notifications.ts` |
| Membership renewal notice | 15 days before the end, 3- and 6-month plans only | `EXPIRY_NOTICE_DAYS` |
| Team | 2 to 30 char name; max 12 incl. captain; min 5 to challenge; one team per player | `lib/teams.ts` |
| Challenge pay | loser 70 / 60 / 100%; draw 50/50; paid at venue only | `LOSER_SHARES`, `settlement` |
| Rating | formula in 4.9; unrated under 3 games | `teamRating` |
| Gamezone | rates 300 / 200 / 150 per person-hour; 1 to 4 hours; 2 consoles; 10:00 to 22:00 | `lib/gamezone.ts` |
| Loyalty | see 6.8 | `lib/points.ts` |
| Quick Rebook | last 12 bookings; >= 2 in same weekday+hour | `lib/rebook.ts` |
| Notifications kept | 50 most recent on device | `MAX_KEPT` |
| Phone format | `^9\d{9}$` everywhere | forms |

## 6. Feature-by-feature requirements (what is stored, relationships)

### 6.1 Authentication
Stores users, OTP/sessions. A user's phone is unique and identifies them to teams. Relationships: `users` 1-1 `user_prefs`, 1-N everything else. Guests have no row; their bookings carry `guest_name/guest_phone`. Decide whether a later sign-up with the same phone adopts earlier guest bookings.

### 6.2 Profile
`users` + `user_prefs`. Customer ID `UF-C-NNNNN`. Status Active/Suspended. "Gameplay stats" (played/wins/losses/draws/goals/assists) and match list are shown but **no data source exists**: they depend on the Opponent/team results or a separate per-game record (Q4).

### 6.3 Court booking
Entities: `bookings`, `booking_holds`, `courts`, `price_rules`, `slot_blocks`, `payments`, `promo_redemptions`. Double-booking prevention by the unique constraint plus a transaction. Registered booking: no name/phone typed; uses the account. Guest booking: details + online full payment. Cancelling shows "Cancelling may be subject to the cancellation policy. The refund amount is confirmed by the venue." Confirmation screen shows ID, date, time, court, payment line and total; calendar `.ics` is client-generated.

### 6.4 Payments
Entities `payments`, `payment_events`, `refunds`. Remarks pattern `"<Purpose> - <order code>"` must match what the gateway returns for reconciliation. Only the server flips `pending -> paid`. Pay-at-venue stays `pay_at_venue` until staff collect.

### 6.5 Promo codes
Entities `promo_codes`, `promo_redemptions`. Codes are case-insensitive; the server recomputes discounts. Promos page needs name, description, terms, discount badge text, kind, dates.

### 6.6 Booking status and history
Customer-visible statuses: Confirmed, Completed, Cancelled; payment: Paid, Pay at venue, Refunded. Profile shows next game + last completed game; the rest and the PDF need the full list. Payment history excludes pay-at-venue until paid.

### 6.7 Membership
Entities `membership_plans`, `memberships`. Statuses: Pending, Active, Expiring soon, Expired, Suspended. Guests see a details form on `/member` in the demo but the rule says guests have no membership: the server must reject guest purchases (decision Q7).

### 6.8 Loyalty points (rules to enforce on the server)
- Earn: regular game = price/100 points, 1 decimal, on the amount actually paid (Rs. 1,250 -> 12.5); free-game bookings earn none. Extra goods: every full Rs. 100 = 1 point. Membership purchase/renewal: 3 months = 30, 6 months = 70, monthly = 0. Challenge game: only the winning captain, 5 points. Registered account holder only.
- Expire: game and challenge points 3 months after the game; goods points 1 year; membership points never.
- Free game cost = 10 games' worth = shift price / 10 (Rs. 1,000 -> 100, 1,200 -> 120, 1,500 -> 150). Claim spends soonest-expiring points first and only points valid on the claim day. Voucher is for one regular booking in that shift; never for challenge games; no expiry in the demo (Q3).
- Warn when points expire within 30 days. Show per-type valid points with the next expiry.
- All awards idempotent; ledger append-only; adjustments need staff + reason.

### 6.9 Notifications
Entity `notifications`, `push_subscriptions`, `reminder_jobs`, `arrival_checkins`. Badges per tile as in 4.11.

### 6.10 Captain mode, teams, challenges, results, ratings
See 4.9. Visible only to registered captains. No player-level stats. Disputed results freeze until an admin resolves. Only approved results change records and ratings.

### 6.11 Gamezone
See 4.10. No promo codes, no loyalty points, no membership discount (assumptions Q8).

### 6.12 Tournaments
Admin-managed content with live scores; the tie-sheet is rounds -> matches; `null` tournament hides the Home section.

### 6.13 Admin-related requirements
See 4.14 and section 7.

## 7. Admin-triggered flows the frontend already expects

1. Venue marks a booking/membership/gamezone payment as paid -> status flips, customer notified.
2. Venue marks a challenge game paid -> `venue_paid_at` set -> "Did you win?" prompt to both captains.
3. "I'm coming" check-ins arrive as alerts (push/dashboard) with booking and customer.
4. Disputed results are reviewed and resolved by admin.
5. Prices, promos, plans, courts, consoles, games, tournaments and scores are edited by admin.
6. Goods sales and game completion trigger loyalty points.
7. Staff need the challenge settlement view (who owes what at the venue).

## 8. Cross-cutting requirements

- **State machines**: booking (4.4), payment (`pending -> paid | expired | failed -> refunded`), membership (`pending -> active -> expiring/expired`, `suspended`), challenge (`pending -> accepted|declined|cancelled|expired`), result (`awaiting_approval -> approved|disputed -> resolved`), voucher (`unused -> used|void`).
- **Authorization matrix**: customers only touch their own data; captains only their own team and challenges; challenged/other captain only for accept/approve; staff for collection; admin for configuration and refunds.
- **Concurrency**: DB transaction + unique index for bookings and gamezone; holds expire by job.
- **Jobs** (scheduler): release expired holds and unpaid orders; send 1-hour reminders; membership expiry notices and status refresh; expire loyalty lots and warn 30 days before; mark past `confirmed` bookings; challenge expiry for unanswered/past; nightly reconciliation of payments.
- **Security**: HTTPS, secure cookies, CSRF protection, input validation, output encoding, rate limits, webhook signature verification, secrets in environment variables (never in git), PII minimisation (no personal data in URLs), audit log for staff actions, backups.
- **Privacy**: phone numbers are looked up by captains only to add a player: return only whether the player exists and their display name.
- **PDF exports** from the full history; keep the same columns as the screen (date, time, court, amount, payment, status / games / payments).
- **Observability**: request logs, error tracking, payment event log.

## 9. Frontend-to-API replacement map

| Frontend today | Replace with |
|---|---|
| `lib/session.ts` (`useSession`, `signOut`, `signInDemo`) | `/auth/*`, `/auth/me` |
| `lib/booking.ts` `getSlots`, `priceFor`, `validatePromo`, `createBooking` | `/slots`, `/bookings/quote`, `/promos/validate`, `/bookings` |
| `lib/payment.ts` `fetchPaymentStatus`, `demoQrPayload`, demo flags | `/payments/:order/status`, QR from the create response |
| `lib/membership.ts` `PLANS`, `validateMemberPromo`, `purchaseMembership`, `sampleCurrent` | `/membership/plans`, `/promos/validate`, `/memberships`, `/me/membership` |
| `lib/points.ts` store + `awardX` functions | `/me/loyalty*`; awards happen server-side only |
| `lib/teams.ts` store and all actions | `/me/mode`, `/teams*`, `/challenges*`, `/results*` |
| `lib/gamezone.ts` | `/gamezone/*` |
| `lib/notifications.ts`, `lib/arrival.ts` | `/me/notifications*`, `/bookings/:code/arrival`, Web Push |
| `lib/prefs.ts` | `/me/preferences` |
| `lib/rebook.ts` | `/me/rebook` |
| `lib/promos.ts` | `/promos` |
| `lib/sample-data.ts` | `/tournaments/current` |
| `lib/sample-profile.ts` | `/me/profile`, `/me/bookings`, `/me/payments`, `/me/gameplay/stats`, `/me/membership`, `/me/loyalty` |
| `lib/site.ts` | `/site` (optional) |
| `lib/pdf.ts` | `/me/exports/:kind` (or keep client PDF fed by full data) |

## 10. Gaps and inconsistencies found in the frontend

1. No login/registration screen; sign-in is a demo button. Profile edits are not saved. Language dropdown does nothing.
2. Home search box and filter button do nothing.
3. Member pricing, monthly allowance and "Priority booking window" are advertised but not implemented in booking.
4. Gamezone bookings do not appear in My bookings, Payment history or Quick Rebook; they have no cancel flow.
5. Challenge acceptance does not choose a court; a court booking must be created on accept.
6. "Gameplay stats" (goals, assists, list of games) has no defined source; the team-only rule says there are no player stats.
7. Demo court prices (1,000/1,200/1,500) differ from the owner's quoted prices (1,250/1,150/1,350).
8. Cancellation policy and refund amounts are not defined; the UI only says "confirmed by the venue".
9. "Booking reminders (SMS)" and "Promotional notifications" switches are saved but nothing sends SMS or promos.
10. Closed-app reminders and the full-screen check-in work only while the app is open until Web Push exists.
11. A booking made with a free-game voucher is confirmed in the UI immediately (total Rs. 0); the server must verify the voucher.
12. The membership expiry popup is dismissed per day in browser storage only.
13. Goods sales have no UI; points for goods need a staff entry point.
14. Weather is fetched from a third party straight from the browser.

## 11. Open questions for the owner

| # | Question |
|---|---|
| Q1 | Login method (OTP or password) and SMS provider? |
| Q2 | Cancellation window and refund percentages? Refund to which method? |
| Q3 | Do free-game vouchers expire? |
| Q4 | Should customers have personal stats (goals, assists) or team stats only? |
| Q5 | How do membership benefits apply: discounted court price, monthly game allowance, priority window? |
| Q6 | Should Gamezone bookings appear in the customer's history? |
| Q7 | Can guests buy a membership? (The rule says no.) |
| Q8 | Do Gamezone sessions earn loyalty points or accept promo codes? |
| Q9 | Real court prices, number of Gamezone consoles, Gamezone hours and max session length? |
| Q10 | What happens to a booking whose online payment expires: auto-cancel and release the slot (assumed)? |
| Q11 | Is the winner's 5 challenge points the only challenge reward? Do losers get nothing? (assumed) |
| Q12 | Who enters game completion, goods sales and no-shows: admin panel only? |

## 12. Suggested build order (when you decide to start)

1. Foundation: database, migrations, auth, roles, audit log, environments (no production data in dev).
2. Courts, prices, slots, bookings with holds and double-booking protection, promo validation.
3. Payments: gateway QR, webhooks, status endpoint, venue payments, refunds, expiry jobs.
4. Profile, preferences, booking history, exports, Quick Rebook.
5. Membership and loyalty (ledger, expiry, claim, vouchers).
6. Notifications, reminders, arrival check-in, Web Push.
7. Teams, challenges, results, ratings.
8. Gamezone, tournaments, content.
9. Admin panel on top of the admin endpoints.
10. Data migration from the existing production system and cut-over plan.
