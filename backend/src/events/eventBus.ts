import { EventEmitter } from "events";
import logger from "../config/logger";

export interface EventPayload {
  [key: string]: unknown;
}

export class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  emit(eventName: string, data: EventPayload): boolean {
    logger.debug(`Event emitted: ${eventName}`, data);
    return super.emit(eventName, data);
  }

  on(eventName: string, listener: (data: EventPayload) => void) {
    logger.debug(`Listener registered for event: ${eventName}`);
    return super.on(eventName, listener);
  }

  once(eventName: string, listener: (data: EventPayload) => void) {
    logger.debug(`One-time listener registered for event: ${eventName}`);
    return super.once(eventName, listener);
  }

  off(eventName: string, listener: (data: EventPayload) => void) {
    logger.debug(`Listener removed for event: ${eventName}`);
    return super.off(eventName, listener);
  }
}

export const eventBus = new EventBus();
export default eventBus;
