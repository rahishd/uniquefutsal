-- Brings a database built from the migration history in line with the developer's existing schema.prisma.
-- The live database very likely already has all of this (created outside migrations); every statement is guarded
-- so it is a no-op there. REVIEW with the developer before running on production.

-- AlterTable
ALTER TABLE "Booking" ALTER COLUMN "loyaltyEnabled" SET DEFAULT true;

-- AlterTable
ALTER TABLE "InventoryLog" ADD COLUMN IF NOT EXISTS "cashAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "onlineAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "costPrice" DROP NOT NULL,
ALTER COLUMN "costPrice" DROP DEFAULT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PageVisit" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '/',
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);
