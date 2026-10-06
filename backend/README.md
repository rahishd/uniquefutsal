# Unique Futsal backend

Express + TypeScript + Prisma + PostgreSQL. Built on the developer's backend, extended for the new customer app.
**Customer records are the most important thing in this project.** Read "Data safety" before running anything.

## Data safety (rules this project follows)

1. **Development and tests only ever use a local database.** `src/config/env.ts` refuses to start when `NODE_ENV` is not
   `production` and `DATABASE_URL` points anywhere except `localhost`. Pasting the real (Neon) address into `.env` on a
   dev machine cannot connect to it.
2. **Migrations are additive.** New tables and new optional/defaulted columns only. Nothing in `prisma/migrations` drops,
   renames or retypes an existing column, and every new statement is guarded with `IF NOT EXISTS`.
3. **Customer records are never deleted by the app.** Cancelling a booking (by the customer or by staff) now marks it
   `cancelled` and keeps the row. Deleting a player keeps the money records and anonymises them (existing behaviour,
   extended to the new tables).
4. **No secrets or customer data in git.** `.env*`, `uploads/`, `scratch/` and PDFs are ignored. `.env.example` has no real values.
5. **Going live is a separate, supervised step** (see the runbook below). Never run `prisma migrate dev`, `migrate reset`
   or `db push` against the real database.

## Run it locally

```bash
npm install
cp .env.example .env            # then set JWT_SECRET and REFRESH_TOKEN_SECRET to random 32+ character strings
npm run db:local                # starts a throw-away local PostgreSQL on :5439 (leave it running)
#   or, if Docker works on your machine: docker compose up -d
npx prisma migrate deploy       # builds the tables in the local database
npm run dev                     # API on http://localhost:5000/api
npm test                        # 150+ tests, against the local "unique_test" database
```

`OTP_ENABLED=false` (default): signup and login are phone + password only; no SMS is sent. Payments use the local
**test gateway** (`PAYMENT_GATEWAY=test`): the QR is clearly fake and `POST /api/payments/:order/test-pay` simulates
the payment. The test gateway is refused in production.

## What the new customer app uses

See `docs/API.md` for every endpoint, who may call it, and the rules it enforces.

## What changed in the developer's code (and why)

| Problem found | Fix |
|---|---|
| `GET /bookings`, `PATCH /bookings/:id`, `GET /users/players`, categories, gamezone records, registrations, expenses, inventory logs, invoice uploads were open to anyone (customer names/phones, mark bookings paid) | Staff-only (`adminOnly`), tested |
| A customer could send `overridePrice`/`addOnsPrice` and book for Rs. 0 | Prices are computed on the server; only staff can override |
| Choosing "full" payment marked the booking paid with no payment | Stays `pending` until staff or the verified gateway confirm |
| A guest could type someone else's phone to spend their free match | Only the signed-in user's own free match; race-safe |
| Customer cancel and staff cancel **deleted** the booking | Soft cancel (`status=cancelled`, `cancelledAt`), slot freed |
| Two people could take the same hour at the same moment | `BookingSlot` unique (date, hour) guard |
| Public `occupancy`, `GET /tournaments`, `check-phone` exposed names, phones, emails | Public views show only what a customer needs |
| JWT secrets defaulted to empty | Server refuses to start without real secrets |
| Signup could delete an unverified account that had records | Refused; never replaces an account with data |
| Debug logging of request bodies | Removed |

Things the developer's code still does that you should know about:
- `GET /api/settings` (public) includes the venue Wi-Fi name and password.
- Login is limited to 5 attempts per 15 minutes per IP address (venue Wi-Fi shares one IP).
- The migration history in the zip did not include some tables/columns the schema uses
  (`PageVisit`, `InventoryLog.cashAmount/onlineAmount`, `Product.costPrice` nullable). They were created outside migrations
  on the live database. `20261005000001_legacy_drift_baseline` adds them with `IF NOT EXISTS`, so it does nothing there.

## Go-live runbook (do not skip steps)

1. **Rotate every secret** that appeared in the developer's `.env.example` (Neon passwords, R2 keys, admin password,
   SMS token) and make sure their repository is private.
2. **Back up** the live database (Neon branch or `pg_dump`), and store the backup somewhere safe.
3. Restore the backup into a **copy** (a Neon branch or a local database) and run everything below on the copy first.
4. `npx prisma migrate status` against the copy. The live database was probably not created by `migrate deploy`; if it says the
   migration table is missing or out of date, ask the developer to **baseline** the first 13 migrations
   (`prisma migrate resolve --applied <name>`) rather than letting Prisma replay them.
5. `npx prisma migrate deploy` on the copy. Then compare row counts of `User`, `Booking`, `MembershipSubscription`,
   `Order`, `Product` before and after: they must be identical.
6. `npx tsx scripts/legacy-bridge.ts slots` (dry run), then `--apply`. Then
   `npx tsx scripts/legacy-bridge.ts loyalty --voucher-period=Day` (dry run) and review the numbers with the owner, then `--apply`.
7. Set production env: `NODE_ENV=production`, real `DATABASE_URL`, strong secrets, `OTP_ENABLED=false` until chosen,
   a real `PAYMENT_GATEWAY` once Fonepay keys exist (the server will not start in production with the test gateway).
8. Repeat steps 5 and 6 on the live database with `--i-have-a-backup`, smoke-test, and keep the backup.

## Open decisions (see docs/API.md for details)

Membership model, real Fonepay merchant details, cancellation/refund policy, number of courts, legacy loyalty
conversion, SMS/OTP provider, who may reset a forgotten password while OTP is off.
