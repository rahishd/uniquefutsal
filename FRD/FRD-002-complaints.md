# FRD-002: Complaints

**Goal:** a customer can tell the venue about a problem from the app, with optional photos, and see the venue's reply.

## Customer flow
1. Home > Popular > **Complaints** (route `/complaints`). Guests see a sign-in prompt.
2. Choose a category: Booking, Payment or refund, Court or facilities, Staff behaviour, Gamezone, Membership, App problem, Other.
3. Write what happened (10 to 1500 characters). Optional: booking code (must be on the customer's own account), up to 3 photos (JPG, PNG or WebP; shrunk in the browser first).
4. Send. A reference code `CP-XXXXXX` is shown.
5. "My complaints" lists every complaint with its status and the venue's reply. A reply or status change creates an in-app notification (type `complaint`).

## Statuses
`open` (Received) > `in_review` (Being looked at) > `resolved` / `closed`.

## Server rules
- Sign-in required. A customer sees only their own complaints.
- Maximum 5 complaints per customer in 24 hours (HTTP 429 after that).
- Photos are decoded and re-encoded by the server (the declared type is never trusted), limited to 8 MB each before compression, 3 per complaint, location data removed, stored under server-chosen names (R2 when configured, otherwise `uploads/complaints`).
- Staff: `GET /complaints/admin?status=` and `PATCH /complaints/admin/:id` `{status?, reply?}`; every change is audited and notifies the customer.

## Not in this version
- Video upload (needs a size limit, virus scan and streaming upload).
- Staff notification when a complaint arrives (the admin portal will list them).
- Complaints from guests.
