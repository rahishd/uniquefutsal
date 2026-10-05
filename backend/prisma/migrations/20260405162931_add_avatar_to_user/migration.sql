-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "discount1MonthDay" INTEGER DEFAULT 0,
ADD COLUMN     "discount1MonthEvening" INTEGER DEFAULT 0,
ADD COLUMN     "discount1MonthMorning" INTEGER DEFAULT 0,
ADD COLUMN     "discount3DaysDay" INTEGER DEFAULT 0,
ADD COLUMN     "discount3DaysEvening" INTEGER DEFAULT 0,
ADD COLUMN     "discount3DaysMorning" INTEGER DEFAULT 0,
ADD COLUMN     "discount3MonthsDay" INTEGER DEFAULT 0,
ADD COLUMN     "discount3MonthsEvening" INTEGER DEFAULT 0,
ADD COLUMN     "discount3MonthsMorning" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN     "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "promoCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar" TEXT;
