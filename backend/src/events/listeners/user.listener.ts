import { eventBus } from "../eventBus";
import logger from "../../config/logger";

export const registerUserListeners = () => {
  eventBus.on("user:created", (data) => {
    logger.info("User created event received", data);
    // Handle user creation logic
  });

  eventBus.on("user:updated", (data) => {
    logger.info("User updated event received", data);
    // Handle user update logic
  });

  eventBus.on("user:deleted", (data) => {
    logger.info("User deleted event received", data);
    // Handle user deletion logic
  });
};

export default registerUserListeners;
