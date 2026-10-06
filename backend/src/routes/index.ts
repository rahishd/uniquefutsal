import { Router } from "express";
import { authRouter } from "../modules/auth";
import { bookingRouter } from "../modules/booking";
import settingsRouter from "../modules/settings/settings.routes";
import { productRouter } from "../modules/product";
import { categoryRouter } from "../modules/category";
import { expenseRouter } from "../modules/expense";
import { tournamentRouter } from "../modules/tournament";
import { gamezoneRouter } from "../modules/gamezone";
import membershipRouter from "../modules/membership/membership.routes";
import { adminRoutes } from "../modules/admin";
import userRouter from "../modules/user/user.routes";
import { adRouter } from "../modules/ad";
import { galleryRouter } from "../modules/gallery";
import { analyticsRouter } from "../modules/analytics";
import { notificationRoutes } from "../modules/notification";
import { auditRouter } from "../modules/audit";
import { loyaltyRouter } from "../modules/loyalty";
import { paymentRouter } from "../modules/payment";
import { promoRouter } from "../modules/promo";
import { profileRouter } from "../modules/profile";
import { teamRouter, challengeRouter, resultRouter } from "../modules/team";
import { siteRouter } from "../modules/site";
import { complaintRouter } from "../modules/complaint";
import { academyRouter } from "../modules/academy";
import { referRouter } from "../modules/refer";
import { contentRouter } from "../modules/content";
import pushService from "../modules/push/push.service";



const router = Router();

// Module Routes
router.use("/auth", authRouter);
router.use("/admin", adminRoutes);
router.use("/bookings", bookingRouter);
router.use("/settings", settingsRouter);
router.use("/products", productRouter);
router.use("/categories", categoryRouter);
router.use("/expenses", expenseRouter);
router.use("/tournaments", tournamentRouter);
router.use("/gamezone", gamezoneRouter);
router.use("/membership", membershipRouter);
router.use("/users", userRouter);
router.use("/ads", adRouter);
router.use("/gallery", galleryRouter);
router.use("/analytics", analyticsRouter);
router.use("/notifications", notificationRoutes);
router.use("/audit", auditRouter);
router.use("/loyalty", loyaltyRouter);
router.use("/payments", paymentRouter);
router.use("/promos", promoRouter);
router.use("/me", profileRouter);
router.use("/teams", teamRouter);
router.use("/challenges", challengeRouter);
router.use("/results", resultRouter);
router.use("/site", siteRouter);
router.use("/complaints", complaintRouter);
router.use("/academy", academyRouter);
router.use("/refer", referRouter);
router.use("/content", contentRouter);

// Public key the app needs to subscribe this device to Web Push (empty/enabled:false when push is not configured)
router.get("/push/public-key", (_req, res) => {
  res.json({ success: true, statusCode: 200, message: "Push key", data: { enabled: pushService.enabled, publicKey: pushService.publicKey } });
});



// TODO: Import and register other module routes here
// Example:
// router.use('/users', userRouter);
// router.use('/products', productRouter);
// router.use('/orders', orderRouter);
// router.use('/payments', paymentRouter);

// Health check route
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date(),
  });
});

export default router;
