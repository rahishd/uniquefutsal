import { eventBus } from "../eventBus";
import logger from "../../config/logger";

export const registerOrderListeners = () => {
  eventBus.on("order:created", (data) => {
    logger.info("Order created event received", data);
    // Handle order creation logic
  });

  eventBus.on("order:confirmed", (data) => {
    logger.info("Order confirmed event received", data);
    // Handle order confirmation logic
  });

  eventBus.on("order:cancelled", (data) => {
    logger.info("Order cancelled event received", data);
    // Handle order cancellation logic
  });
};

export default registerOrderListeners;
