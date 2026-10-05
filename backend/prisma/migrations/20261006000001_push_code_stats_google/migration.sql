-- Additive only: short booking code, per-player game stats, Google account link for password reset.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "code" TEXT;
CREATE INDEX IF NOT EXISTS "Booking_code_idx" ON "Booking"("code");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleSub" TEXT, ADD COLUMN IF NOT EXISTS "googleEmail" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");

CREATE TABLE IF NOT EXISTS "PlayerGameStat" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "goals" INTEGER NOT NULL DEFAULT 0,
  "assists" INTEGER NOT NULL DEFAULT 0,
  "recordedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlayerGameStat_bookingId_userId_key" ON "PlayerGameStat"("bookingId", "userId");
CREATE INDEX IF NOT EXISTS "PlayerGameStat_userId_idx" ON "PlayerGameStat"("userId");
