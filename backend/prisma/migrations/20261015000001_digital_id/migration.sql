-- Digital ID (QR code of a customer). Additive and idempotent. The admin portal has the same table in its sql/014.
CREATE TABLE IF NOT EXISTS "DigitalId" (
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3),
  CONSTRAINT "DigitalId_pkey" PRIMARY KEY ("userId")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalId_token_key" ON "DigitalId"("token");
