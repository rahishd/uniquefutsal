-- Additive migration for the new customer app. Adds only new tables and new optional/defaulted columns.
-- Safe to re-run: every statement is guarded with IF NOT EXISTS.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "challengeId" TEXT,
ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentOrderCode" TEXT,
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'regular',
ADD COLUMN IF NOT EXISTS "voucherId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT,
ADD COLUMN IF NOT EXISTS "href" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserPrefs" (
    "userId" TEXT NOT NULL,
    "smsReminders" BOOLEAN NOT NULL DEFAULT true,
    "promoNotifications" BOOLEAN NOT NULL DEFAULT true,
    "popupReminder" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "mode" TEXT NOT NULL DEFAULT 'player',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPrefs_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentOrder" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "userId" TEXT,
    "guestPhone" TEXT,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remarks" TEXT NOT NULL,
    "qrPayload" TEXT,
    "gatewayRef" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentEvent" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoyaltyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "points" DECIMAL(8,1) NOT NULL,
    "earnedOn" TEXT NOT NULL,
    "expiresOn" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FreeGameVoucher" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "cost" DECIMAL(8,1) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "bookingId" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "FreeGameVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GoodsSale" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT,
    "amount" INTEGER NOT NULL,
    "items" TEXT,
    "soldBy" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT 'Tilottama',
    "captainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT NOT NULL DEFAULT 'MID',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Challenge" (
    "id" TEXT NOT NULL,
    "challengerTeamId" TEXT NOT NULL,
    "challengedTeamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "courtPrice" INTEGER NOT NULL,
    "loserPct" INTEGER NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bookingId" TEXT,
    "venuePaidAt" TIMESTAMP(3),
    "venuePaidBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChallengeResult" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "submittedByTeamId" TEXT NOT NULL,
    "scoreSubmitter" INTEGER NOT NULL,
    "scoreOther" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_approval',
    "approvedBy" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChallengePrompt" (
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengePrompt_pkey" PRIMARY KEY ("challengeId","userId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GzConsole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GzConsole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GzGame" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GzGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GzPlan" (
    "players" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "ratePerPersonHour" INTEGER NOT NULL,

    CONSTRAINT "GzPlan_pkey" PRIMARY KEY ("players")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GzBooking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "consoleId" TEXT NOT NULL,
    "gameTitle" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "hours" INTEGER NOT NULL,
    "players" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "holdExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GzBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ArrivalCheckin" (
    "refId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snoozedUntil" TIMESTAMP(3),
    "alertedAt" TIMESTAMP(3),

    CONSTRAINT "ArrivalCheckin_pkey" PRIMARY KEY ("refId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TournamentRound" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "TournamentRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TournamentMatch" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "home" TEXT,
    "away" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "note" TEXT,
    "startsAt" TIMESTAMP(3),
    "venue" TEXT,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentOrder_orderCode_key" ON "PaymentOrder"("orderCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentOrder_userId_idx" ON "PaymentOrder"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentOrder_status_expiresAt_idx" ON "PaymentOrder"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentEvent_orderCode_idx" ON "PaymentEvent"("orderCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoyaltyEntry_userId_idx" ON "LoyaltyEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyEntry_kind_sourceType_sourceId_key" ON "LoyaltyEntry"("kind", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FreeGameVoucher_userId_status_idx" ON "FreeGameVoucher"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Team_captainId_key" ON "Team"("captainId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_userId_key" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Challenge_challengerTeamId_idx" ON "Challenge"("challengerTeamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Challenge_challengedTeamId_idx" ON "Challenge"("challengedTeamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChallengeResult_challengeId_idx" ON "ChallengeResult"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GzConsole_name_key" ON "GzConsole"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GzGame_title_key" ON "GzGame"("title");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GzBooking_code_key" ON "GzBooking"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GzBooking_consoleId_date_idx" ON "GzBooking"("consoleId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GzBooking_userId_idx" ON "GzBooking"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentRound_tournamentId_idx" ON "TournamentRound"("tournamentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TournamentMatch_roundId_idx" ON "TournamentMatch"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMember_teamId_fkey') THEN
    ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChallengeResult_challengeId_fkey') THEN
    ALTER TABLE "ChallengeResult" ADD CONSTRAINT "ChallengeResult_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TournamentMatch_roundId_fkey') THEN
    ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
