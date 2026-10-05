-- CreateTable
CREATE TABLE IF NOT EXISTS "GzSlot" (
    "id" TEXT NOT NULL,
    "consoleId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "bookingCode" TEXT NOT NULL,

    CONSTRAINT "GzSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GzSlot_bookingCode_idx" ON "GzSlot"("bookingCode");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GzSlot_consoleId_date_hour_key" ON "GzSlot"("consoleId", "date", "hour");

