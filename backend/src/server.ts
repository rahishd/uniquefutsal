import { env } from "./config/env";
import app from "./app";
import logger from "./config/logger";
import { prisma } from "./config/db";
import { registerUserListeners } from "./events/listeners/user.listener";
import { registerOrderListeners } from "./events/listeners/order.listener";
import { initCronTasks } from "./tasks/cron";

const PORT = env.PORT || 5000;

(async () => {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info("✅ Database connected successfully");

    // Register event listeners
    registerUserListeners();
    registerOrderListeners();
    logger.info("✅ Event listeners registered");

    // Initialize cron tasks
    initCronTasks();

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running on port ${PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      logger.info("📭 Gracefully shutting down server...");
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("✋ Server closed");
        process.exit(0);
      });
    });

    process.on("SIGTERM", async () => {
      logger.info("📭 Gracefully shutting down server...");
      server.close(async () => {
        await prisma.$disconnect();
        logger.info("✋ Server closed");
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("❌ Failed to start server", error);
    process.exit(1);
  }
})();
