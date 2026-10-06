-- Additive only: a special VIP discount code that staff give to one customer.
-- The customer types it once (claims it); after that it is applied to every booking they make.
CREATE TABLE IF NOT EXISTS "VipCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "claimedAt" TIMESTAMP(3),
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VipCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VipCode_userId_key" ON "VipCode"("userId");
CREATE INDEX IF NOT EXISTS "VipCode_code_idx" ON "VipCode"("code");
