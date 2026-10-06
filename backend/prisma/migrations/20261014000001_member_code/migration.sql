-- Additive only: the Membership ID (for example MEM-10291) that staff and the member both see.
ALTER TABLE "MembershipSubscription" ADD COLUMN IF NOT EXISTS "memberCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipSubscription_memberCode_key" ON "MembershipSubscription"("memberCode");
