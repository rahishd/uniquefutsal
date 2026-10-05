-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "price1Month" DOUBLE PRECISION,
ADD COLUMN     "price3Days" DOUBLE PRECISION,
ADD COLUMN     "price3Months" DOUBLE PRECISION,
ADD COLUMN     "pricingMatrix" TEXT;

-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN     "chosenCategory" TEXT,
ADD COLUMN     "chosenDuration" TEXT,
ADD COLUMN     "totalPrice" DOUBLE PRECISION;
