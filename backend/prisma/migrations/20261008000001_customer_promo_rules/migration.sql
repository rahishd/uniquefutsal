-- Additive only: promo codes staff have switched OFF for one customer. A row means "blocked"; no row means allowed.
-- code is the promo code in capitals, or '*' for every promo code.
CREATE TABLE IF NOT EXISTS "CustomerPromoRule" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPromoRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPromoRule_userId_code_key" ON "CustomerPromoRule"("userId", "code");
CREATE INDEX IF NOT EXISTS "CustomerPromoRule_userId_idx" ON "CustomerPromoRule"("userId");
