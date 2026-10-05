-- AlterTable
ALTER TABLE "MembershipSubscription" ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "paymentVerifiedBy" TEXT,
ADD COLUMN     "timeSlot" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';
