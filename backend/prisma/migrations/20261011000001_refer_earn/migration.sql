-- Additive only: Refer & Earn. A customer books a game on behalf of another team; staff approve it and both get loyalty points.
CREATE TABLE IF NOT EXISTS "Referral" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "teamName" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "bookingCode" TEXT,
  "gameDate" TEXT NOT NULL,
  "gameTime" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "referrerPoints" DECIMAL(8,1) NOT NULL,
  "friendPoints" DECIMAL(8,1) NOT NULL,
  "staffNote" TEXT,
  "decidedBy" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_code_key" ON "Referral"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Referral_bookingId_key" ON "Referral"("bookingId");
CREATE INDEX IF NOT EXISTS "Referral_referrerId_idx" ON "Referral"("referrerId");
CREATE INDEX IF NOT EXISTS "Referral_friendId_idx" ON "Referral"("friendId");
CREATE INDEX IF NOT EXISTS "Referral_status_createdAt_idx" ON "Referral"("status", "createdAt");
