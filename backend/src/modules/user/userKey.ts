import { Prisma } from "@prisma/client";
import { AppError } from "../../middlewares/error.middleware";

type Tx = Prisma.TransactionClient;

// The phone number is the customer's ID. The customer-app tables keep it as a plain value (no foreign key),
// so when staff change a number every one of them must move with it, or that customer's points, team,
// vouchers and history would be left behind. Called from updatePlayer inside its transaction.
export async function moveUserKey(tx: Tx, oldPhone: string, newPhone: string): Promise<void> {
  await tx.userPrefs.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.pushSubscription.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.paymentOrder.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.loyaltyEntry.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.freeGameVoucher.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.goodsSale.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone, phone: newPhone } });
  await tx.team.updateMany({ where: { captainId: oldPhone }, data: { captainId: newPhone } });
  await tx.teamMember.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.challengePrompt.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
  await tx.gzBooking.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone, guestPhone: null } });
  await tx.arrivalCheckin.updateMany({ where: { userId: oldPhone }, data: { userId: newPhone } });
}

// When a player is deleted: personal customer-app data goes, money records stay (anonymised), and a team
// cannot be left without its captain.
export async function cleanupUserForDelete(tx: Tx, phone: string): Promise<void> {
  const captain = await tx.team.findUnique({ where: { captainId: phone } });
  if (captain) throw new AppError(409, `This player is the captain of "${captain.name}". Move or remove that team first.`);
  await tx.teamMember.deleteMany({ where: { userId: phone } });
  await tx.userPrefs.deleteMany({ where: { userId: phone } });
  await tx.pushSubscription.deleteMany({ where: { userId: phone } });
  await tx.challengePrompt.deleteMany({ where: { userId: phone } });
  await tx.arrivalCheckin.deleteMany({ where: { userId: phone } });
  await tx.freeGameVoucher.deleteMany({ where: { userId: phone } });
  await tx.loyaltyEntry.deleteMany({ where: { userId: phone } });
  await tx.paymentOrder.updateMany({ where: { userId: phone }, data: { userId: null } });
  await tx.goodsSale.updateMany({ where: { userId: phone }, data: { userId: null, phone: null } });
  await tx.gzBooking.updateMany({ where: { userId: phone }, data: { userId: null, guestName: "Deleted Player", guestPhone: null } });
}
