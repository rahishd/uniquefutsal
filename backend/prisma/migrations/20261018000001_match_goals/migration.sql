-- Goals of a tie-sheet match (side, minute, scorer), entered by staff or the match-day host in the admin portal. The admin portal has the
-- same table in its sql/018. Additive and idempotent. Deleting a match removes its goals.
CREATE TABLE IF NOT EXISTS "MatchGoal" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "minute" INTEGER,
  "scorer" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchGoal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MatchGoal_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "TournamentMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MatchGoal_matchId_idx" ON "MatchGoal"("matchId");
