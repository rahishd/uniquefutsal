# FRD — Futsal Booking System Customer Site

**Project:** Futsal Customer Booking & Experience Platform
**Platform:** Progressive Web App (PWA)
**Application Type:** Customer-facing web application
**Primary Users:** Futsal Customers / Players
**Database:** PostgreSQL
**Frontend:** TypeScript / JavaScript / Tailwind CSS
**Architecture:** Responsive PWA
**Payment:** Online payment gateway integration
**Version:** 1.0

## 1. Purpose

The Futsal Customer Site will allow customers to interact with the futsal facility digitally.

Customers will be able to:

1. View and book available futsal slots.
2. Apply promotional codes.
3. Make online payments.
4. View active promotional offers.
5. Find other players/teams and challenge them.
6. Earn, view and claim loyalty rewards.
7. View gameplay statistics.
8. Manage their profile.
9. Purchase futsal memberships.
10. Install/use the website as a PWA on mobile and desktop.

The system must provide a fast, mobile-first experience suitable for customers booking futsal from their phones.

## 2. Technology Requirements

### Frontend

* TypeScript
* JavaScript
* Tailwind CSS
* Responsive UI
* PWA
* Service Worker
* Web App Manifest
* Installable application
* Offline shell/cache support
* Mobile-first design

### Backend

* TypeScript / JavaScript
* REST API or equivalent API architecture
* Authentication and authorization
* Server-side validation
* Payment verification
* Booking validation

### Database

PostgreSQL

The database should be relational and structured so that future features such as multiple futsal venues, tournaments, teams and additional sports can be added without redesigning the entire system.

## 3. Customer Navigation

The PWA must contain a persistent customer navigation bar.

### Mobile Bottom Navigation

Recommended:

```
┌─────────────────────────────────────┐
│                                     │
│             PAGE CONTENT            │
│                                     │
├─────────────────────────────────────┤
│ Home │ Book │ Offers │ Challenges │ Profile │
└─────────────────────────────────────┘
```

Recommended primary navigation:

* 🏠 **Home** — Customer dashboard and important information.
* ⚽ **Book** — Futsal slot booking.
* 🎟️ **Offers** — Promocodes and promotional offers.
* ⚔️ **Challenges** — Find and challenge opponents.
* 👤 **Profile** — Profile, loyalty, gameplay statistics and membership.

### Additional Navigation

Inside Profile:

```
Profile
├── My Profile
├── My Bookings
├── Gameplay Stats
├── Loyalty Points
├── Membership
├── Payment History
└── Settings
```

A More/Menu option can be used if the mobile navigation becomes crowded.

## 4. Home Page

The Home page should provide a quick overview of the customer's futsal experience.

### Sections

**Welcome Section**

```
Welcome back, Rahish 👋

Ready for your next game?
[Book a Slot]
```

**Upcoming Booking**

Show the customer's next booking:

```
Upcoming Game

Saturday, 10 October
7:00 PM – 8:00 PM

Court 1

[View Booking]
```

If there is no upcoming booking:

```
No upcoming games

[Book Your Next Game]
```

**Quick Actions**

Cards:

* Book Futsal
* View Offers
* Challenge Opponent
* Loyalty Points
* Membership
* Gameplay Stats

**Loyalty Preview**

```
⭐ Loyalty Points

850 Points

150 points until next reward

[View Loyalty]
```

**Membership Preview**

If the customer has membership:

```
Premium Membership

Valid until:
31 December 2026

[View Membership]
```

Otherwise:

```
Become a Member

Get exclusive benefits.

[View Membership Plans]
```

**Promotions**

Display active promotions:

```
🔥 Dashain Special

15% OFF

Use Code: DASHAIN83

[View Offer]
```

## 5. Futsal Booking

This is the primary functionality.

### Booking Flow

```
Select Date
     ↓
Select Time Slot
     ↓
Select Court
     ↓
Booking Summary
     ↓
Apply Promo Code
     ↓
Customer Details
     ↓
Payment
     ↓
Payment Verification
     ↓
Booking Confirmation
```

## 6. Date Selection

Customer can select:

* Today
* Tomorrow
* Calendar date

Only dates available for booking should be selectable.

Past dates must not be selectable.

## 7. Slot Availability

Display available time slots.

Example:

```
Saturday, October 10

Morning
05:00 – 06:00    Available
06:00 – 07:00    Available

Day
10:00 – 11:00    Booked
11:00 – 12:00    Available

Evening
06:00 – 07:00    Available
07:00 – 08:00    Almost Full
08:00 – 09:00    Booked
```

Status:

* Available
* Almost Full
* Booked
* Closed
* Maintenance

## 8. Booking Summary

Before payment:

```
Booking Summary

Date:
October 10, 2026

Time:
7:00 PM – 8:00 PM

Court:
Court 1

Base Price:
NPR 1,350

Discount:
NPR 135

Promo:
DASHAIN83

Total:
NPR 1,215

[Proceed to Payment]
```

## 9. Promo Code

Customer must be able to enter a promo code during booking.

```
Promo Code

[ DASHAIN83          ] [Apply]

✓ Promo applied successfully

Discount: NPR 135
```

Validation should check:

* Code exists
* Active/inactive
* Start date
* End date
* Usage limit
* Customer usage limit
* Minimum booking amount
* Applicable time slots
* Applicable days
* Applicable customer type
* Discount percentage/fixed amount
* Maximum discount
* Membership restrictions

Invalid codes should provide clear messages.

Example: *This promotional code has expired.*

## 10. Payment

The customer should be able to pay the booking amount online.

Payment architecture should support configurable payment gateways.

Potential payment methods:

* eSewa
* Khalti
* Fonepay
* Card
* Bank/payment gateway

The actual enabled gateways should be controlled from the backend/admin system.

### Payment Flow

```
Booking Created
      ↓
Payment Initiated
      ↓
Customer Pays
      ↓
Gateway Callback
      ↓
Payment Verification
      ↓
Payment Successful
      ↓
Booking Confirmed
```

**Important:** The system must not mark a booking as fully paid merely because the customer was redirected to a payment gateway. Payment must be verified server-side.

## 11. Booking Confirmation

After successful payment:

```
🎉 Booking Confirmed!

Booking ID:
UF-20261010-00125

Date:
10 October 2026

Time:
7:00 PM – 8:00 PM

Court:
Court 1

Paid:
NPR 1,215

[View Booking]
[Add to Calendar]
```

Provide a QR/booking code if required for check-in.

## 12. My Bookings

Customer can view:

**Upcoming**

* Booking ID
* Date
* Time
* Court
* Amount
* Payment status
* Booking status

**Past**

* Completed bookings
* Cancelled bookings
* No-show bookings

### Booking Detail

Show:

* Booking ID
* Customer
* Date
* Time
* Court
* Base price
* Discount
* Promo code
* Payment
* Booking status
* Created date

## 13. Cancellation

If cancellation is supported by business policy:

Customer can select: **Cancel Booking**

System displays:

```
Cancellation Policy

Refund amount:
NPR XXX

Cancellation fee:
NPR XXX

Final refund:
NPR XXX

[Confirm Cancellation]
```

Cancellation eligibility must be controlled by the booking policy.

## 14. Promo Code Page

A dedicated Offers / Promocodes page must be available.

Example:

```
🔥 Active Offers

Dashain Babal Offer
12–16 October

UP TO 15% OFF

Code:
DASHAIN83

[Copy Code]
[Book Now]
```

Each promotion can display:

* Offer name
* Description
* Discount
* Promo code
* Valid from
* Valid until
* Applicable booking conditions
* Terms & conditions

Tabs:

```
Active | Upcoming | Expired
```

Customers should not be able to see internal/admin-only promotional information.

## 15. Challenge Opponents

This will be a social/gameplay feature.

### Opponent Discovery

Customer can view eligible players/teams.

Possible filters:

* Player/Team
* Skill level
* Location
* Preferred playing time
* Availability
* Recent activity

Example:

```
Find Opponent

Team Alpha
⭐ Intermediate
12 Games
8 Wins

[View Profile]
[Challenge]
```

## 16. Challenge System

Customer selects: **Challenge**

Then:

```
Challenge Team Alpha

Preferred Date:
[ Select Date ]

Preferred Time:
[ Select Time ]

Message:
[ Let's play! ]

[Send Challenge]
```

Challenge status:

* Pending
* Accepted
* Rejected
* Expired
* Cancelled
* Completed

## 17. Challenge Acceptance

Opponent receives a challenge notification.

```
⚔️ New Challenge

Team Alpha challenged you.

Saturday
7:00 PM

[Accept]
[Reject]
```

If accepted:

```
Challenge Accepted!

Your game is confirmed.

[View Challenge]
```

The exact conversion of an accepted challenge into a booking should be handled carefully by the backend to prevent double-booking.

## 18. Challenge History

Customer can view:

**Sent**

* Opponent
* Date
* Time
* Status

**Received**

* Challenger
* Date
* Time
* Status

**Completed**

* Opponent
* Result
* Score
* Date

## 19. Loyalty Points

Customer must have a dedicated loyalty dashboard.

Example:

```
⭐ My Loyalty

1,250 Points

Current Reward:
100 points = NPR 100 reward

[View Rewards]
[Claim Reward]
```

The loyalty engine should be configurable from the backend.

## 20. Loyalty Transaction History

Show:

```
+100   Booking Completed
+50    Promotional Bonus
-100   Reward Claimed
+100   Booking Completed
```

Each transaction should contain:

* Date
* Description
* Points
* Type
* Reference

Types:

* Earned
* Claimed
* Expired
* Adjusted

## 21. Claim Loyalty Reward

Customer selects an available reward.

```
Reward

100 Points

Free Game Voucher

[Claim Reward]
```

After confirmation:

```
Reward Claimed!

Voucher:
UF-LOYAL-8291

Valid Until:
30 October 2026

[Use Now]
```

The system must prevent:

* Duplicate claims
* Negative points
* Expired rewards being claimed
* Unauthorized point manipulation

## 22. Gameplay Statistics

Customer profile should have a Gameplay Stats section.

Example:

```
⚽ Gameplay Statistics

Games Played       42
Wins               27
Losses             10
Draws               5
Win Rate          64.3%

Goals              58
Assists            31
```

Depending on what data the futsal operation actually records, additional statistics can include:

* Games played
* Wins
* Losses
* Draws
* Goals
* Assists
* MVP awards
* Clean sheets
* Challenges
* Tournament participation
* Average rating

Only statistics actually recorded by the system should be displayed.

## 23. Gameplay History

Customer can view previous games:

```
10 Oct 2026
Team A vs Team B
Score: 6 – 4
Result: WIN

03 Oct 2026
Team A vs Team C
Score: 3 – 5
Result: LOSS
```

## 24. Customer Profile

Profile fields:

**Personal Information**

* Profile photo
* Full name
* Mobile number
* Email
* Location
* Date of birth — optional
* Preferred position — optional

**Account Information**

* Customer ID
* Registration date
* Account status

**Preferences**

* Notifications
* Promotional notifications
* Language
* Theme

## 25. Membership

Customer should be able to view and purchase available memberships.

### Membership Plans

Example:

```
Basic
NPR X / Month

✓ Member pricing
✓ Loyalty benefits

[Choose Plan]
```

```
Premium
NPR X / Month

✓ Member pricing
✓ Priority booking
✓ Loyalty bonus
✓ Exclusive offers

[Choose Plan]
```

The actual benefits and prices should come from the backend.

## 26. Membership Purchase Flow

```
Select Membership
       ↓
View Benefits
       ↓
Confirm Customer
       ↓
Payment
       ↓
Payment Verification
       ↓
Membership Activated
```

After purchase:

```
🎉 Membership Activated

Premium Membership

Valid:
01 Oct 2026 – 30 Sep 2027

Membership ID:
MEM-10291
```

## 27. Membership Dashboard

Show:

* Membership name
* Membership ID
* Start date
* Expiry date
* Status
* Benefits
* Usage
* Renewal option

Status:

* Active
* Expiring Soon
* Expired
* Suspended

## 28. Notifications

PWA should support notifications where permitted.

Notification types:

**Booking**

* Booking confirmed
* Payment successful
* Booking reminder
* Booking cancelled
* Booking changed

**Challenge**

* New challenge
* Challenge accepted
* Challenge rejected
* Challenge reminder

**Loyalty**

* Points earned
* Reward available
* Reward claimed
* Points expiring

**Membership**

* Membership activated
* Membership expiring
* Membership expired

**Promotions**

* New promotion
* Promo reminder

## 29. PWA Requirements

The website must behave like a modern mobile application.

Required:

* `manifest.json`
* Service Worker
* Install prompt
* App icon
* Splash screen
* Responsive layout
* Mobile-first UI
* Offline cached shell
* Fast loading
* HTTPS
* Installable on Android
* Installable on supported desktop browsers

## 30. PWA Navigation Behavior

The bottom navigation must remain accessible while scrolling.

Recommended:

```
┌─────────────────────────────┐
│                             │
│       Application           │
│         Content             │
│                             │
│                             │
├─────────────────────────────┤
│ Home Book Offers ⚔️ Profile │
└─────────────────────────────┘
```

On desktop, this can transform into:

```
Logo

Home
Book
Offers
Challenges
Profile

                    [Notifications]
                    [Profile]
```

## 31. Database Design — PostgreSQL

Core tables should include:

```
users
customer_profiles

courts
court_slots
bookings
booking_items

payments
payment_transactions

promo_codes
promo_redemptions

challenges
challenge_participants

loyalty_accounts
loyalty_transactions
loyalty_rewards
loyalty_claims

gameplay_stats
gameplay_matches
gameplay_players

membership_plans
memberships
membership_transactions

notifications
notification_preferences
```

## 32. Important Database Relationships

**Customer**

```
Customer
   │
   ├── Bookings
   ├── Payments
   ├── Loyalty Account
   ├── Loyalty Transactions
   ├── Challenges
   ├── Gameplay Stats
   ├── Membership
   └── Notifications
```

**Booking**

```
Booking
 ├── Customer
 ├── Court
 ├── Slot
 ├── Promo Code
 └── Payment
```

**Challenge**

```
Challenge
 ├── Challenger
 ├── Opponent
 ├── Preferred Slot
 └── Result
```

## 33. Security Requirements

The customer site must implement:

* Secure authentication
* Password/OTP protection according to selected authentication method
* HTTPS
* Secure cookies/session handling
* CSRF protection where applicable
* Input validation
* API authorization
* Server-side price calculation
* Server-side promo validation
* Server-side payment verification
* Rate limiting
* Protection against duplicate bookings
* Protection against duplicate payment callbacks
* Protection against loyalty-point manipulation

Never trust price, discount, loyalty points, booking availability or payment status supplied by the browser.

## 34. Booking Concurrency

This is especially important.

If two customers attempt to book the same slot simultaneously:

```
Customer A ──┐
             ├── Same Slot
Customer B ──┘
```

PostgreSQL/backend must ensure that only one valid booking can obtain the slot.

Use database-level constraints/transactions to prevent double booking.

## 35. Payment Security

The frontend should never determine:

```
payment_success = true
```

Instead:

```
Customer
   ↓
Payment Gateway
   ↓
Gateway Callback
   ↓
Backend Verification
   ↓
PostgreSQL
   ↓
Booking = CONFIRMED
```

This is critical for the production system.

## 36. API Modules

Recommended backend API structure:

```
/api/auth
/api/customers
/api/bookings
/api/courts
/api/slots
/api/payments
/api/promocodes
/api/offers
/api/challenges
/api/loyalty
/api/gameplay
/api/memberships
/api/notifications
```

Example:

```
GET    /api/slots
POST   /api/bookings
GET    /api/bookings/:id
POST   /api/bookings/:id/cancel

GET    /api/promocodes
POST   /api/promocodes/validate

GET    /api/challenges
POST   /api/challenges
PATCH  /api/challenges/:id

GET    /api/loyalty
GET    /api/loyalty/transactions
POST   /api/loyalty/rewards/:id/claim

GET    /api/gameplay/stats
GET    /api/gameplay/history

GET    /api/memberships
POST   /api/memberships/purchase
GET    /api/memberships/current
```

## 37. Responsive Design

The system must support:

**Mobile** — Primary target:

* Android phones
* iPhones
* Small screens

**Tablet**

* iPad
* Android tablets

**Desktop**

* Laptop
* Desktop monitor

The mobile experience should remain the priority because most customers will book from phones.

## 38. UI Design Requirements

Recommended design:

* Modern sports/futsal aesthetic
* Clean cards
* Large touch targets
* Rounded components
* Clear booking CTA
* Minimal checkout steps
* Fast transitions
* Skeleton loading
* Toast notifications
* Confirmation dialogs
* Empty states
* Error states
* Loading states

Example primary CTA:

```
┌─────────────────────────────┐
│       ⚽ BOOK NOW            │
└─────────────────────────────┘
```

## 39. Error Handling

Examples:

* **Slot unavailable:** Sorry, this slot was just booked by another customer.
* **Payment failure:** Payment could not be completed. Your booking has not been confirmed.
* **Promo invalid:** This promo code is invalid or expired.
* **Loyalty:** You don't have enough points to claim this reward.
* **Membership:** This membership is no longer available.

Every error should be user-friendly and should not expose database/server errors.

## 40. Performance Requirements

Target:

* Fast initial load
* Optimized images
* Lazy loading
* Code splitting
* API pagination
* Database indexing
* Cached static assets
* PWA caching
* Minimal unnecessary API requests

The booking flow should be particularly fast:

```
Home → Book → Slot → Payment
```

## 41. Version 1 Scope

### Must Have

✅ PWA
✅ Customer registration/login
✅ Home
✅ Booking
✅ Slot availability
✅ Booking summary
✅ Promo code
✅ Online payment
✅ Booking confirmation
✅ My Bookings
✅ Promo/Offers page
✅ Opponent discovery
✅ Challenges
✅ Loyalty points
✅ Loyalty claim
✅ Gameplay statistics
✅ Customer profile
✅ Membership plans
✅ Membership purchase
✅ Notifications
✅ Responsive navigation

### Future Scope

The architecture should remain ready for:

* Multiple futsal venues
* Team management
* Tournament registration
* Tournament brackets
* Live match scores
* Player rankings
* Leaderboards
* Referral system
* Gift vouchers
* Wallet
* Food ordering
* Merchandise
* Event booking
* Multi-sport booking
* LORA Sports ecosystem

## 42. Final Customer Site Navigation

```
CUSTOMER PWA
│
├── 🏠 Home
│   ├── Upcoming Booking
│   ├── Quick Actions
│   ├── Loyalty
│   ├── Membership
│   └── Offers
│
├── ⚽ Book
│   ├── Select Date
│   ├── Select Slot
│   ├── Court
│   ├── Promo Code
│   ├── Booking Summary
│   └── Payment
│
├── 🎟️ Offers
│   ├── Active
│   ├── Upcoming
│   └── Expired
│
├── ⚔️ Challenges
│   ├── Find Opponents
│   ├── My Challenges
│   ├── Received
│   ├── Sent
│   └── Completed
│
└── 👤 Profile
    ├── Personal Profile
    ├── My Bookings
    ├── Gameplay Stats
    ├── Loyalty Points
    ├── Membership
    ├── Payment History
    └── Settings
```

## Recommended Architecture

For this stack, build it as a PWA customer frontend + TypeScript/JavaScript backend API + PostgreSQL, with Tailwind CSS handling the responsive UI. Most importantly, keep booking availability, pricing, promo validation, loyalty calculations and payment verification on the server, not in the client.

This FRD is intentionally customer-site only; the existing admin/superadmin system can consume the same PostgreSQL/API layer without exposing admin functionality to customers.
