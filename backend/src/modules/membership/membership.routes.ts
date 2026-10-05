import { Router } from "express";
import membershipController from "./membership.controller";
import { authMiddleware, optionalAuthMiddleware } from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";

import customerRoutes from "./membership.customer";

const router = Router();

// Customer screen (offers, my membership, request): declared first so these paths win over "/plans/:id" style routes
router.use(customerRoutes);

// Plan routes (public for reading, admin for writing)
router.get("/plans", membershipController.getAllPlans);
router.get("/plans/:id", membershipController.getPlanById);
router.post("/plans", ...adminOnly, membershipController.createPlan);
router.patch("/plans/:id", ...adminOnly, membershipController.updatePlan);
router.delete("/plans/:id", ...adminOnly, membershipController.deletePlan);
router.post("/plans/:id/featured", ...adminOnly, membershipController.setFeaturedPlan);
router.get("/plans/:id/availability", optionalAuthMiddleware, membershipController.checkPlanAvailability);

// Time slots
router.get("/timeslots", membershipController.getAvailableTimeSlots);

// Subscription routes (require auth)
router.get("/subscriptions/me", authMiddleware, membershipController.getMySubscription);
router.get("/subscriptions/history", authMiddleware, membershipController.getMySubscriptionHistory);
router.post("/subscriptions", authMiddleware, membershipController.subscribe);
router.post("/subscriptions/:id/cancel", authMiddleware, membershipController.cancelMySubscription);

// Admin routes
router.get("/subscriptions", ...adminOnly, membershipController.getAllSubscriptions);
router.post("/subscriptions/verify-payment", ...adminOnly, membershipController.verifyPayment);
router.get("/subscriptions/:id/settlement-summary", ...adminOnly, membershipController.getSettlementSummary);
router.post("/subscriptions/:id/settle-payment", ...adminOnly, membershipController.settlePayment);
router.post("/subscriptions/manual", ...adminOnly, membershipController.manualCreateSubscription);
router.patch("/subscriptions/:id", ...adminOnly, membershipController.updateSubscription);
router.post("/subscriptions/:id/renew", ...adminOnly, membershipController.renewSubscription);
router.post("/subscriptions/:id/invoice", ...adminOnly, membershipController.uploadInvoice);
router.delete("/subscriptions/:id", ...adminOnly, membershipController.deleteSubscription);

export default router;
