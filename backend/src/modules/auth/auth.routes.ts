import { Router, Request, Response, NextFunction } from "express";
import env from "../../config/env";
import { body } from "express-validator";
import authController from "./auth.controller";
import validateRequest from "../../middlewares/validate.middleware";
import { authRateLimitMiddleware } from "../../middlewares/rateLimit.middleware";
import authMiddleware, { optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import googleRoutes from "./google.routes";

const router = Router();

router.use(googleRoutes); // Google link + password reset (no SMS)

// OTP / SMS verification is switched off (OTP_ENABLED=false). These routes answer 503 until the owner turns it on.
const needsOtp = (_req: Request, res: Response, next: NextFunction) => {
  if (!env.OTP_ENABLED) {
    return res.status(503).json({ success: false, statusCode: 503, message: "SMS verification is not available right now." });
  }
  next();
};

router.post(
  "/login",
  authRateLimitMiddleware,
  [
    body("identifier")
      .notEmpty()
      .withMessage("Phone number is required"),
    body("password").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.login,
);

router.post(
  "/signup",
  authRateLimitMiddleware,
  [
    body("email").optional().isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("name").trim().notEmpty(),
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .matches(/^9\d{9}$/)
      .withMessage("Enter a 10-digit mobile number starting with 9"),
  ],
  optionalAuthMiddleware,
  validateRequest,
  authController.signup,
);

router.post(
  "/refresh",
  [body("refreshToken").notEmpty()],
  validateRequest,
  authController.refreshToken,
);

router.post("/logout", authController.logout);

router.post("/verify-otp", needsOtp, authController.verifyOTP);
router.post("/resend-otp", needsOtp, authController.resendOTP);
router.post(
  "/check-phone",
  [
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any"),
  ],
  validateRequest,
  authController.checkPhone
);

router.post(
  "/forgot-password",
  needsOtp,
  authRateLimitMiddleware,
  [
    body("phoneNumber")
      .notEmpty()
      .withMessage("Phone number is required")
      .isMobilePhone("any"),
  ],
  validateRequest,
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  needsOtp,
  authRateLimitMiddleware,
  [
    body("phoneNumber").notEmpty(),
    body("otp").isLength({ min: 6, max: 6 }),
    body("newPassword").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.resetPassword,
);

router.get("/me", authMiddleware, authController.me);
router.patch("/me", authMiddleware, authController.updateMe);
router.patch(
  "/change-password",
  authMiddleware,
  [
    body("currentPassword").isString().notEmpty().withMessage("Enter your current password"),
    body("newPassword").isLength({ min: 6 }),
  ],
  validateRequest,
  authController.changePassword,
);

export default router;
