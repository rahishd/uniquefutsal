import cron from "node-cron";
import logger from "../config/logger";
import bookingService from "../modules/booking/booking.service";
import membershipService from "../modules/membership/membership.service";
import { analyticsService } from "../modules/analytics";
import { runAppJobs } from "../jobs/app.jobs";


export const initCronTasks = () => {
  // Customer app jobs: release unpaid QR holds every minute; reminders and challenge expiry every 10 minutes;
  // loyalty expiry warnings once a day.
  cron.schedule("* * * * *", () => void runAppJobs("minute"));
  cron.schedule("*/10 * * * *", () => void runAppJobs("tenMinutes"));
  cron.schedule("0 9 * * *", () => void runAppJobs("daily"));

  // Run every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    try {
      logger.info("Running scheduled task: Auto-completing past bookings...");
      await bookingService.autoCompletePastBookings();
      logger.info("Auto-complete task finished successfully.");
    } catch (error) {
      logger.error("Error in auto-complete cron task:", error);
    }
  });

  // Run every hour for match reminders
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running scheduled task: Sending match reminders...");
      await bookingService.sendReminders();
      logger.info("Match reminder task finished.");
    } catch (error) {
      logger.error("Error in match reminder cron task:", error);
    }
  });

  // Daily Membership Expiry Reminders at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    try {
      logger.info("Running scheduled task: Sending membership expiry reminders...");
      await membershipService.sendExpiryReminders();
      logger.info("Membership expiry reminder task finished.");
    } catch (error) {
      logger.error("Error in membership expiry reminder cron task:", error);
    }
  });

  // Daily Report at 11:00 PM
  cron.schedule("0 23 * * *", async () => {
    try {
      logger.info("Running scheduled task: Generating Daily Business Report...");
      const stats = await analyticsService.getDailyStats();

      const summary = `
        DAILY BUSINESS REPORT (${stats.date})
        ===================================
        No of Bookings: ${stats.bookingsCount}
        Cash: Rs. ${stats.cash.toLocaleString()}
        Online: Rs. ${stats.online.toLocaleString()}
        Income: Rs. ${stats.income.toLocaleString()}
        Expenses: Rs. ${stats.expenses.toLocaleString()}
        
        Stocks:
        1. Mineral Water: ${stats.mineralWaterStock}
        2. Other items (Shoes, Gloves, Socks, etc.): ${stats.otherStock}
        ===================================
      `;

      logger.info(summary);

      // Note: Automated WhatsApp sending requires a dedicated WhatsApp API gateway (like Twilio or UltraMsg).
      // If a webhook or API is provided, the message can be sent here automatically to 9811940018.

    } catch (error) {
      logger.error("Error in daily report cron task:", error);
    }
  });

  logger.info("Cron tasks initialized.");

};
