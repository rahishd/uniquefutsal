-- Additive only: a tournament the venue hosts for a manager (details and the days and hours of the court), so the app can show it.
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "hostedEvent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "hostName" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "hostPhone" TEXT;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "minRate" INTEGER;
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "billClosedAt" TIMESTAMP(3);
ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

CREATE TABLE IF NOT EXISTS "TournamentDay" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "startHour" INTEGER NOT NULL,
  "endHour" INTEGER NOT NULL,
  "blockIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  CONSTRAINT "TournamentDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TournamentDay_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentDay_tournamentId_date_key" ON "TournamentDay"("tournamentId", "date");
