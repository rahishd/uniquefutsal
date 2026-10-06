import { Router, Request, Response, NextFunction } from "express";
import { body, query } from "express-validator";
import bookingController from "./booking.controller";
import checkoutController from "./booking.checkout";
import bookingExtras from "./booking.extras";
import validateRequest from "../../middlewares/validate.middleware";
import {
  authMiddleware,
  optionalAuthMiddleware,
} from "../../middlewares/auth.middleware";
import adminOnly from "../../middlewares/admin.middleware";

const router = Router();

// Normalize a date value to YYYY-MM-DD string, or return "" on failure
const toYMD = (value: unknown): string => {

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  // Already correct format
  const regexTest = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (regexTest) return trimmed;

  // ISO timestamp – strip time part
  if (trimmed.includes("T")) {
    const result = trimmed.split("T")[0];
    return result;
  }

  // Try JS Date parse as a last resort
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    const result = `${y}-${m}-${d}`;
    return result;
  }

  return "";
};

// Create a new booking
router.post(
  "/",
  optionalAuthMiddleware,
  [
    body("date").custom((value, { req }) => {
      const normalized = toYMD(value);
      if (!normalized) {
        throw new Error("Date must be in YYYY-MM-DD format");
      }
      req.body.date = normalized; // write clean value back
      return true;
    }),
    body("startTime")
      .matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage("Start time must be in HH:mm format"),
    body("duration")
      .isInt({ min: 1, max: 3 })
      .withMessage("Duration must be between 1 and 3 hours"),
    body("paymentMethod")
      .isIn(["full", "advance", "venue"])
      .withMessage("Invalid payment method"),
    body("customerName").optional({ checkFalsy: true }).trim().notEmpty(),
    body("customerEmail")
      .optional({ checkFalsy: true })
      .isEmail()
      .normalizeEmail(),
    body("customerPhone").optional({ checkFalsy: true }).trim().notEmpty(),
    body("addOns").optional().isArray(),
    body("promoCode").optional({ checkFalsy: true }).trim(),
    body("discountAmount").optional().isFloat({ min: 0 }),
    body("notes").optional({ checkFalsy: true }).trim(),
  ],
  validateRequest,
  bookingController.createBooking,
);

const slotBody = [
  body("date").custom((value, { req }) => {
    const normalized = toYMD(value);
    if (!normalized) throw new Error("Date must be in YYYY-MM-DD format");
    req.body.date = normalized;
    return true;
  }),
  body("startTime").matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage("Start time must be in HH:mm format"),
  body("duration").optional().isInt({ min: 1, max: 3 }).withMessage("Duration must be between 1 and 3 hours").toInt(),
  body("promoCode").optional({ checkFalsy: true }).isString().trim(),
  body("voucherId").optional({ checkFalsy: true }).isString().trim(),
];

// Customer app: price + promo preview (no side effects)
router.post("/quote", optionalAuthMiddleware, slotBody, validateRequest, checkoutController.quote);

// Customer app: create a booking (guest rules, 10-day window, held slot, QR for online payment)
router.post(
  "/checkout",
  optionalAuthMiddleware,
  [...slotBody, body("method").isIn(["fonepay", "venue"]).withMessage("Choose Fonepay or Pay at venue")],
  validateRequest,
  checkoutController.checkout,
);

// Get all bookings (with optional filters)
router.get(
  "/",
  ...adminOnly,
  [
    query("date").optional().isISO8601(),
    query("status")
      .optional()
      .isIn(["pending", "confirmed", "cancelled", "completed"]),
    query("userId").optional().isString(),
    query("page").optional().isInt({ min: 1 }).toInt(),
    query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  bookingController.getBookings,
);
// Get available slots for a date
router.get(
  "/available",
  [
    query("date").custom((value, { req }) => {
      const normalized = toYMD(value);
      if (!normalized) {
        throw new Error("Date must be in YYYY-MM-DD format");
      }
      (req.query as Record<string, string>).date = normalized;
      return true;
    }),
  ],
  validateRequest,
  bookingController.getAvailableSlots,
);

// Get full occupancy (bookings + memberships) for a date
router.get(
  "/occupancy",
  optionalAuthMiddleware,
  [
    query("date").custom((value, { req }) => {
      const normalized = toYMD(value);
      if (!normalized) {
        throw new Error("Date must be in YYYY-MM-DD format");
      }
      (req.query as Record<string, string>).date = normalized;
      return true;
    }),
  ],
  validateRequest,
  bookingController.getOccupancy,
);

// Get a single booking by ID
// Quick Rebook, "I'm coming" check-in and the staff arrivals list
router.use(bookingExtras);

// My own bookings (signed-in customer)
router.get("/me", authMiddleware, bookingController.getMyBookings);

// Get a single booking by ID (owner or staff only)
router.get("/:id", authMiddleware, bookingController.getBookingById);

// Update a booking
router.patch(
  "/:id",
  ...adminOnly,
  [
    body("status")
      .optional()
      .isIn(["pending", "confirmed", "cancelled", "completed"]),
    body("paymentStatus")
      .optional()
      .isIn(["pending", "completed", "partially_paid"]),
    body("notes").optional().trim(),
  ],
  validateRequest,
  bookingController.updateBooking,
);

// Cancel a booking
router.post("/:id/cancel", authMiddleware, bookingController.cancelBooking);

// Delete a booking entirely
router.delete("/:id", ...adminOnly, bookingController.deleteBooking);

// Upload invoice
router.post("/:id/invoice", ...adminOnly, bookingController.uploadInvoice);

export default router;
