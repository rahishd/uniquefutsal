# FRD-004 Refer & Earn

When a customer books a game on behalf of another team, both earn loyalty points. Staff control the points.

## Customer
- Popular tile "Refer & Earn" opens `/refer` (sign-in required).
- The customer picks the booking they made for the other team, and enters the other team's captain (mobile number, registered) and the team name.
- The referral is pending. The captain is notified. When staff approve it, both accounts get points and a notification; if staff reject it, the reason is shown.
- The customer can withdraw a pending referral.

## Admin (staff)
- Referrals list with status tabs, search, the booking, both people (call buttons) and the points each would get.
- Approve (optionally changing the points for either person first) or reject with a reason.
- Adjust points of an approved referral (adds or removes the difference on both ledgers).
- Settings: points for the person who booked, points for the other captain, pause or resume the feature.

## Rules enforced on the server
Own booking only, not cancelled, last 30 days, one referral per booking, not yourself, friend must be registered, 5 per day, points written only by staff approval (idempotent), referral points expire after 12 months.

## Open points
Whether approval should be automatic once the game is completed and paid; whether a captain should earn when their team's game is booked by someone already in their team.
