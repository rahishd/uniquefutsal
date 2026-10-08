-- Additive only: who a counter sale was for (name, even if not registered) and the booking (slot) it belongs to.
ALTER TABLE "GoodsSale" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "GoodsSale" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
