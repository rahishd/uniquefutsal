import { Request, Response, NextFunction } from "express";
import membershipService from "./membership.service";
import { AuthRequest } from "../../middlewares/auth.middleware";
import { AuditService } from "../audit";
import { prisma } from "../../config/db";

class MembershipController {
  // Plans
  async getAllPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === "true";
      const plans = await membershipService.getAllPlans(includeInactive);
      res.status(200).json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await membershipService.getPlanById(req.params.id);
      if (!plan) {
        return res.status(404).json({ success: false, message: "Plan not found" });
      }
      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await membershipService.createPlan(req.body);
      
      await AuditService.log({
        action: "CREATE_MEMBERSHIP_PLAN",
        entity: "MembershipPlan",
        entityId: plan.id,
        changes: `Created membership plan "${plan.name}" with price ${plan.price}`,
        userId: req.user?.id,
      });

      res.status(201).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await membershipService.updatePlan(req.params.id, req.body);
      
      await AuditService.log({
        action: "UPDATE_MEMBERSHIP_PLAN",
        entity: "MembershipPlan",
        entityId: plan.id,
        changes: `Updated membership plan "${plan.name}" details`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  async deletePlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await membershipService.getPlanById(req.params.id);
      const planName = plan ? plan.name : req.params.id;

      await membershipService.deletePlan(req.params.id);
      
      await AuditService.log({
        action: "DELETE_MEMBERSHIP_PLAN",
        entity: "MembershipPlan",
        entityId: req.params.id,
        changes: `Deleted membership plan "${planName}"`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, message: "Plan deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async setFeaturedPlan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const plan = await membershipService.setFeaturedPlan(req.params.id);
      
      await AuditService.log({
        action: "SET_FEATURED_MEMBERSHIP_PLAN",
        entity: "MembershipPlan",
        entityId: plan.id,
        changes: `Set membership plan "${plan.name}" as featured`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: plan });
    } catch (error) {
      next(error);
    }
  }

  // Subscriptions
  async getMySubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const subscription = await membershipService.getActiveSubscription(userId);
      res.status(200).json({ success: true, data: subscription });
    } catch (error) {
      next(error);
    }
  }

  async getMySubscriptionHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const subscriptions = await membershipService.getUserSubscriptions(userId);
      res.status(200).json({ success: true, data: subscriptions });
    } catch (error) {
      next(error);
    }
  }

  async subscribe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const isManual = req.user?.role === "admin" || req.user?.role === "superadmin";
      const subscription = await membershipService.createSubscription(userId, { ...req.body, isManual });
      res.status(201).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "User already has an active subscription") {
          return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message === "User not found") {
          return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message === "Plan not found or inactive") {
          return res.status(400).json({ success: false, message: error.message });
        }
      }
      next(error);
    }
  }

  async cancelMySubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const subscription = await membershipService.cancelSubscription(req.params.id, userId);
      res.status(200).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Subscription not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // Admin: Get all subscriptions
  async getAllSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const filter = req.query.filter as string | undefined;
      
      let subscriptions;
      if (filter === "pending") {
        subscriptions = await membershipService.getPendingSubscriptions();
      } else {
        subscriptions = await membershipService.getAllSubscriptions();
      }
      
      res.status(200).json({ success: true, data: subscriptions });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Verify payment and activate subscription
  async verifyPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const { subscriptionId, sendSms } = req.body;
      if (!subscriptionId) {
        return res.status(400).json({ success: false, message: "Subscription ID is required" });
      }
      
      const subscription = await membershipService.verifyPayment(subscriptionId, adminUserId, sendSms);
      
      const userName = (subscription as any).user?.name || (subscription as any).user?.phoneNumber || "Unknown User";
      const planName = (subscription as any).plan?.name || "Unknown Plan";

      await AuditService.log({
        action: "VERIFY_MEMBERSHIP_PAYMENT",
        entity: "MembershipSubscription",
        entityId: subscriptionId,
        changes: `Verified payment for "${userName}" subscription on "${planName}" plan`,
        userId: adminUserId,
      });

      res.status(200).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Subscription not found") {
          return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message === "Payment already verified") {
          return res.status(400).json({ success: false, message: error.message });
        }
      }
      next(error);
    }
  }

  // Admin: Settle membership payment in booking ledger
  async settlePayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const subscriptionId = req.params.id;
      const { method, cashAmount, onlineAmount, waterBottles, addOns, addOnsPrice } = req.body;

      if (!method || cashAmount === undefined || onlineAmount === undefined) {
        return res.status(400).json({
          success: false,
          message: "method, cashAmount and onlineAmount are required",
        });
      }

      const subscription = await membershipService.settlePayment(subscriptionId, {
        method,
        cashAmount,
        onlineAmount,
        waterBottles,
        addOns,
        addOnsPrice,
      });

      const userName = (subscription as any).user?.name || (subscription as any).user?.phoneNumber || "Unknown User";
      const planName = (subscription as any).plan?.name || "Unknown Plan";

      await AuditService.log({
        action: "SETTLE_MEMBERSHIP_PAYMENT",
        entity: "MembershipSubscription",
        entityId: subscriptionId,
        changes: `Settled payment of Rs. ${cashAmount + onlineAmount} via ${method} for "${userName}" subscription on "${planName}" plan`,
        userId: adminUserId,
      });

      res.status(200).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.message === "Subscription not found" ||
          error.message === "Membership payment record not found in booking ledger"
        ) {
          return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === "Amounts cannot be negative") {
          return res.status(400).json({ success: false, message: error.message });
        }
      }
      next(error);
    }
  }

  // Admin: Get membership payment settlement summary from booking ledger
  async getSettlementSummary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const subscriptionId = req.params.id;
      const summary = await membershipService.getSettlementSummary(subscriptionId);

      res.status(200).json({ success: true, data: summary });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.message === "Subscription not found" ||
          error.message === "Membership payment record not found in booking ledger"
        ) {
          return res.status(404).json({ success: false, message: error.message });
        }
      }
      next(error);
    }
  }

  // Get available time slots
  async getAvailableTimeSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const startDate = req.query.startDate as string | undefined;
      const slots = await membershipService.getAvailableTimeSlots(startDate);
      res.status(200).json({ success: true, data: slots });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete subscription
  async deleteSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      
      const subscriptionId = req.params.id;
      let userName = "Unknown User";
      let planName = "Unknown Plan";
      try {
        const subscription = await prisma.membershipSubscription.findUnique({
          where: { id: subscriptionId },
          include: { plan: true, user: true },
        });
        if (subscription) {
          userName = subscription.user?.name || subscription.user?.phoneNumber || "Unknown User";
          planName = subscription.plan?.name || "Unknown Plan";
        }
      } catch (e) {
        // ignore
      }

      await membershipService.deleteSubscription(subscriptionId);
      
      await AuditService.log({
        action: "DELETE_MEMBERSHIP_SUBSCRIPTION",
        entity: "MembershipSubscription",
        entityId: subscriptionId,
        changes: `Deleted membership subscription of "${userName}" on "${planName}" plan`,
        userId: adminUserId,
      });

      res.status(200).json({ success: true, message: "Subscription deleted successfully" });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Subscription not found") {
        return res.status(404).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // Check if plan is available for current user
  async checkPlanAvailability(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      const planId = req.params.id;
      
      if (!userId) {
        // If not logged in, all plans are technically available
        return res.status(200).json({ success: true, data: { available: true } });
      }
      
      const available = await membershipService.isPlanAvailableForUser(planId, userId);
      res.status(200).json({ success: true, data: { available } });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Update subscription
  async updateSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subscriptionId = req.params.id;
      const subscription = await membershipService.updateSubscription(subscriptionId, req.body);
      
      const userName = (subscription as any).user?.name || (subscription as any).user?.phoneNumber || "Unknown User";
      const planName = (subscription as any).plan?.name || "Unknown Plan";

      await AuditService.log({
        action: "UPDATE_MEMBERSHIP_SUBSCRIPTION",
        entity: "MembershipSubscription",
        entityId: subscriptionId,
        changes: `Updated membership subscription details for "${userName}" on "${planName}" plan`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Subscription not found") {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // Admin: Renew subscription
  async renewSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subscriptionId = req.params.id;
      const subscription = await membershipService.renewSubscription(subscriptionId);
      
      const userName = (subscription as any).user?.name || (subscription as any).user?.phoneNumber || "Unknown User";
      const planName = (subscription as any).plan?.name || "Unknown Plan";

      await AuditService.log({
        action: "RENEW_MEMBERSHIP_SUBSCRIPTION",
        entity: "MembershipSubscription",
        entityId: subscriptionId,
        changes: `Renewed membership subscription for "${userName}" on "${planName}" plan`,
        userId: req.user?.id,
      });

      res.status(200).json({ success: true, data: subscription });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "Subscription not found") {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  // Admin: Manual create subscription
  async manualCreateSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const subscription = await membershipService.manualCreateSubscription(req.body);
      
      const userName = (subscription as any).user?.name || (subscription as any).user?.phoneNumber || "Unknown User";
      const planName = (subscription as any).plan?.name || "Unknown Plan";

      await AuditService.log({
        action: "CREATE_MEMBERSHIP_SUBSCRIPTION_MANUAL",
        entity: "MembershipSubscription",
        entityId: subscription.id,
        changes: `Manually created membership subscription for "${userName}" on "${planName}" plan`,
        userId: req.user?.id,
      });

      res.status(201).json({ success: true, data: subscription });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Upload invoice PDF
  async uploadInvoice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ success: false, message: "PDF content is required" });
      }

      const result = await membershipService.uploadInvoice(id, pdfBase64);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new MembershipController();
