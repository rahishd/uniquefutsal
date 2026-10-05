import { Router, Response } from "express";
import { body } from "express-validator";
import { OAuth2Client } from "google-auth-library";
import env from "../../config/env";
import logger from "../../config/logger";
import { prisma } from "../../config/db";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { HashUtil } from "../../utils/hash";
import { AppError } from "../../middlewares/error.middleware";
import validateRequest from "../../middlewares/validate.middleware";
import { authRateLimitMiddleware } from "../../middlewares/rateLimit.middleware";
import authMiddleware, { AuthRequest } from "../../middlewares/auth.middleware";

// Password reset without SMS: the customer proves they own the Google account linked to their number (a second factor
// on top of knowing the phone number). The account is linked while signed in, from Profile > Settings.

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

const defaultVerifier: GoogleVerifier = async (idToken) => {
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email) throw new Error("Incomplete Google token");
  return { sub: p.sub, email: p.email, emailVerified: p.email_verified === true };
};
let verifier: GoogleVerifier = defaultVerifier;
export const setGoogleVerifier = (v: GoogleVerifier | null) => {
  verifier = v ?? defaultVerifier;
};

// Verifies the token. A bad or expired token gives one generic message (no hints for attackers).
async function identify(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) throw new AppError(503, "Google verification is not set up yet. Please contact the venue to reset your password.");
  try {
    const id = await verifier(idToken);
    if (!id.emailVerified) throw new Error("unverified email");
    return id;
  } catch (e) {
    logger.warn(`Google token rejected: ${(e as Error).message}`);
    throw new AppError(401, "Google sign-in could not be verified. Try again.");
  }
}

const router = Router();

router.get(
  "/google/status",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const u = await prisma.user.findUnique({ where: { phoneNumber: req.user!.id }, select: { googleSub: true, googleEmail: true } });
    res.json(ApiResponseUtil.success(200, "Google status", { configured: Boolean(env.GOOGLE_CLIENT_ID), clientId: env.GOOGLE_CLIENT_ID || null, linked: Boolean(u?.googleSub), email: u?.googleEmail ?? null }));
  }),
);

// Public: the app needs the client id to show the Google button on the reset screen.
router.get("/google/config", (_req, res) => {
  res.json(ApiResponseUtil.success(200, "Google config", { configured: Boolean(env.GOOGLE_CLIENT_ID), clientId: env.GOOGLE_CLIENT_ID || null }));
});

router.post(
  "/google/link",
  authMiddleware,
  authRateLimitMiddleware,
  [body("idToken").isString().notEmpty()],
  validateRequest,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const id = await identify(req.body.idToken);
    const owner = await prisma.user.findUnique({ where: { googleSub: id.sub }, select: { phoneNumber: true } });
    if (owner && owner.phoneNumber !== req.user!.id) throw new AppError(409, "This Google account is already linked to another player.");
    await prisma.user.update({ where: { phoneNumber: req.user!.id }, data: { googleSub: id.sub, googleEmail: id.email } });
    res.json(ApiResponseUtil.success(200, "Google account linked", { email: id.email }));
  }),
);

router.post(
  "/google/unlink",
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await prisma.user.update({ where: { phoneNumber: req.user!.id }, data: { googleSub: null, googleEmail: null } });
    res.json(ApiResponseUtil.success(200, "Google account unlinked"));
  }),
);

const NOT_MATCHED = "This Google account is not linked to that mobile number. Contact the venue to reset your password.";

router.post(
  "/reset-password/google",
  authRateLimitMiddleware,
  [
    body("phoneNumber").matches(/^9\d{9}$/).withMessage("Enter a 10-digit mobile number starting with 9"),
    body("idToken").isString().notEmpty(),
    body("newPassword").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  validateRequest,
  asyncHandler(async (req, res: Response) => {
    const id = await identify(req.body.idToken);
    const user = await prisma.user.findUnique({ where: { phoneNumber: req.body.phoneNumber } });
    // Same message whether the number is unknown or linked to someone else's Google account.
    if (!user || !user.isActive || !user.googleSub || user.googleSub !== id.sub) throw new AppError(403, NOT_MATCHED);
    await prisma.user.update({ where: { phoneNumber: user.phoneNumber }, data: { password: await HashUtil.hash(req.body.newPassword) } });
    logger.info(`Password reset through Google for ${user.phoneNumber.slice(0, 3)}*******`);
    res.json(ApiResponseUtil.success(200, "Password changed. You can sign in now."));
  }),
);

export default router;
