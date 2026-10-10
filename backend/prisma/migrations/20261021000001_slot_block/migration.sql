-- Additive and idempotent: hours the venue has closed (staff "Blocked hours"). The admin portal writes them; the customer
-- app reads them to hide the hour and show the reason. The table may already exist from the admin setup.
CREATE TABLE IF NOT EXISTS "SlotBlock" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlotBlock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SlotBlock_date_hour_key" ON "SlotBlock"("date", "hour");
