-- Customers following a tie-sheet match for live updates. Additive and idempotent. Deleting a match removes its follows.
CREATE TABLE IF NOT EXISTS "MatchFollow" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MatchFollow_userId_matchId_key" ON "MatchFollow"("userId", "matchId");
CREATE INDEX IF NOT EXISTS "MatchFollow_matchId_idx" ON "MatchFollow"("matchId");
DO $$ BEGIN
  ALTER TABLE "MatchFollow" ADD CONSTRAINT "MatchFollow_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
