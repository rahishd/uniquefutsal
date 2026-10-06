import { randomBytes } from "crypto";
import { Router, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { authMiddleware, AuthRequest } from "../../middlewares/auth.middleware";
import { AppError } from "../../middlewares/error.middleware";
import { prisma } from "../../config/db";

// The QR on the customer's Digital ID holds only "UFID1." + a random token. It carries no name, number or booking data, so a
// scan outside Unique Futsal shows nothing useful; only staff signed in to the admin portal can resolve it to a customer.
export const QR_PREFIX = "UFID1.";
export const newToken = () => randomBytes(24).toString("base64url"); // 192 bits, not guessable

export const digitalIdRouter = Router();
digitalIdRouter.use(authMiddleware);

async function view(userId: string) {
  const user = await prisma.user.findUnique({ where: { phoneNumber: userId }, select: { name: true, phoneNumber: true, role: true } });
  if (!user || user.role !== "user") throw new AppError(403, "Digital ID is for customers");
  let row = await prisma.digitalId.findUnique({ where: { userId } });
  if (!row) {
    try {
      row = await prisma.digitalId.create({ data: { userId, token: newToken() } });
    } catch {
      row = await prisma.digitalId.findUnique({ where: { userId } }); // two requests at once: the other one won
    }
  }
  if (!row) throw new AppError(500, "Could not make your Digital ID");
  return { name: user.name || "Player", phone: user.phoneNumber, payload: QR_PREFIX + row.token, createdAt: row.createdAt, replacedAt: row.rotatedAt };
}

// The signed-in customer's card (made on first use).
digitalIdRouter.get("/", asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json(ApiResponseUtil.success(200, "Digital ID", await view(req.user!.id)));
}));

// Lost or shared by mistake: make a new QR. The old one stops working at once.
digitalIdRouter.post("/replace", asyncHandler(async (req: AuthRequest, res: Response) => {
  await view(req.user!.id);
  await prisma.digitalId.update({ where: { userId: req.user!.id }, data: { token: newToken(), rotatedAt: new Date() } });
  res.json(ApiResponseUtil.success(200, "New Digital ID made", await view(req.user!.id)));
}));
