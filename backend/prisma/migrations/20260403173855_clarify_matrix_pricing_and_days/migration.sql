/*
  Warnings:

  - You are about to drop the column `price1Month` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `price3Days` on the `MembershipPlan` table. All the data in the column will be lost.
  - You are about to drop the column `price3Months` on the `MembershipPlan` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "price1Month",
DROP COLUMN "price3Days",
DROP COLUMN "price3Months",
ADD COLUMN     "price1MonthDay" INTEGER,
ADD COLUMN     "price1MonthEvening" INTEGER,
ADD COLUMN     "price1MonthMorning" INTEGER,
ADD COLUMN     "price3DaysDay" INTEGER,
ADD COLUMN     "price3DaysEvening" INTEGER,
ADD COLUMN     "price3DaysMorning" INTEGER,
ADD COLUMN     "price3MonthsDay" INTEGER,
ADD COLUMN     "price3MonthsEvening" INTEGER,
ADD COLUMN     "price3MonthsMorning" INTEGER;

-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN     "chosenDays" TEXT[];
