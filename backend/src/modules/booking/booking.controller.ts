import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import BookingService from "./booking.service";
import { CreateBookingDTO, UpdateBookingDTO } from "./booking.dto";
import { CONSTANTS } from "../../config/constants";
import { AppError } from "../../middlewares/error.middleware";
import { AuditService } from "../audit";
import prisma from "../../config/db";

const isAdminRole = (role?: string) => role === "admin" || role === "superadmin";

// Customers may never set prices, discounts or "manual booking" flags: the server computes them.
// Only staff can override the price or pass an add-on amount.
function cleanCreateDto(body: CreateBookingDTO, isManual: boolean): CreateBookingDTO {
  const dto: CreateBookingDTO = { ...body };
  delete dto.isManual;
  if (!isManual) {
    delete dto.overridePrice;
    delete dto.addOnsPrice;
    delete dto.discountAmount;
    delete dto.loyaltyEnabled;
  }
  return dto;
}

export const bookingController = {
  // Create a new booking
  createBooking: asyncHandler(async (req: AuthRequest, res: Response) => {
    const isManual = isAdminRole(req.user?.role);
    const dto: CreateBookingDTO = cleanCreateDto(req.body, isManual);
    const normalizedDate = dto.date.includes("T")
      ? dto.date.split("T")[0]
      : dto.date;
    const userId = req.user?.id; // Optional - supports guest bookings

    const result = await BookingService.createBooking(
      { ...dto, date: normalizedDate, isManual },
      userId,
    );

    await AuditService.log({
      action: "CREATE_BOOKING",
      entity: "Booking",
      entityId: result.id,
      changes: `Created booking for ${result.customerName || "Player"} on ${result.date} at ${result.startTime}`,
      userId: req.user?.id,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.CREATED)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.CREATED,
          "Booking created successfully",
          result,
        ),
      );
  }),

  // Get all bookings (with optional filters)
  getBookings: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, status, userId, page, limit, search, paymentStatus } = req.query;

    const pageNumber = page ? parseInt(page as string, 10) : undefined;
    const limitNumber = limit ? parseInt(limit as string, 10) : undefined;

    const result = await BookingService.getBookings({
      date: date as string,
      status: status as string,
      userId: userId as string,
      page: pageNumber,
      limit: limitNumber,
      search: search as string,
      paymentStatus: paymentStatus as string,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Bookings retrieved successfully",
          result,
        ),
      );
  }),

  // Get a single booking by ID
  getBookingById: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    // Only the booking's owner or staff may read it (it contains name, phone and payment details).
    const owner = await prisma.booking.findUnique({ where: { id }, select: { userId: true } });
    if (!owner) throw new AppError(404, "Booking not found");
    if (!isAdminRole(req.user?.role) && owner.userId !== req.user?.id) {
      throw new AppError(403, "You cannot view this booking");
    }

    const result = await BookingService.getBookingById(id);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Booking retrieved successfully",
          result,
        ),
      );
  }),

  // The signed-in customer's own bookings
  getMyBookings: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { page, limit } = req.query;
    const result = await BookingService.getBookings({
      userId: req.user!.id,
      customerView: true,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(ApiResponseUtil.success(CONSTANTS.HTTP_STATUS.OK, "Bookings retrieved successfully", result));
  }),

  // Update a booking
  updateBooking: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const dto: UpdateBookingDTO = req.body;

    const result = await BookingService.updateBooking(id, dto);

    await AuditService.log({
      action: "UPDATE_BOOKING",
      entity: "Booking",
      entityId: id,
      changes: result.status === "cancelled"
        ? `Cancelled booking for "${result.customerName || "Player"}" (Date: ${result.date}, Time: ${result.startTime})`
        : `Updated booking details for "${result.customerName || "Player"}" (Date: ${result.date}, Time: ${result.startTime})`,
      userId: req.user?.id,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Booking updated successfully",
          result,
        ),
      );
  }),

  // Cancel a booking
  cancelBooking: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const result = await BookingService.cancelBooking(id, userId);

    await AuditService.log({
      action: "CANCEL_BOOKING",
      entity: "Booking",
      entityId: id,
      changes: `Cancelled booking for "${result.customerName || "Player"}" on ${result.date} at ${result.startTime}`,
      userId: req.user?.id,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Booking cancelled successfully",
          result,
        ),
      );
  }),

  // Delete a booking (Admin only typically, or whatever role middleware protects it)
  deleteBooking: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const sendSms = req.query.sendSms !== "false";

    let customerName = "Player";
    let bookingDate = "";
    let bookingTime = "";
    try {
      const booking = await BookingService.getBookingById(id);
      if (booking) {
        customerName = booking.customerName || "Player";
        bookingDate = booking.date;
        bookingTime = booking.startTime;
      }
    } catch (e) {
      // ignore
    }

    await BookingService.deleteBooking(id, sendSms);

    await AuditService.log({
      action: "DELETE_BOOKING",
      entity: "Booking",
      entityId: id,
      changes: `Deleted booking for "${customerName}" on ${bookingDate} at ${bookingTime}`,
      userId: req.user?.id,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Booking deleted successfully",
        ),
      );
  }),

  // Get available slots for a date
  getAvailableSlots: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date, duration } = req.query;

    if (!date) {
      res
        .status(CONSTANTS.HTTP_STATUS.BAD_REQUEST)
        .json(
          ApiResponseUtil.error(
            CONSTANTS.HTTP_STATUS.BAD_REQUEST,
            "Date is required",
          ),
        );
      return;
    }

    const normalizedDate = (date as string).includes("T")
      ? (date as string).split("T")[0]
      : (date as string);

    const result = await BookingService.getAvailableSlots(
      normalizedDate,
      duration ? parseInt(duration as string) : 1,
    );

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Available slots retrieved successfully",
          { slots: result },
        ),
      );
  }),

  // Get full occupancy (bookings + memberships) for a date
  getOccupancy: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { date } = req.query;

    if (!date) {
      res
        .status(CONSTANTS.HTTP_STATUS.BAD_REQUEST)
        .json(
          ApiResponseUtil.error(
            CONSTANTS.HTTP_STATUS.BAD_REQUEST,
            "Date is required",
          ),
        );
      return;
    }

    const normalizedDate = (date as string).includes("T")
      ? (date as string).split("T")[0]
      : (date as string);

    const full = await BookingService.getOccupancy(normalizedDate);
    // The public calendar only needs to know WHICH hours are taken. Names and phone numbers are staff only.
    const result = isAdminRole(req.user?.role)
      ? full
      : {
          bookings: (full.bookings as any[]).map((b: any) => ({ date: b.date, startTime: b.startTime, endTime: b.endTime, duration: b.duration, status: b.status, type: "booking" })),
          memberships: full.memberships.map((m: any) => ({ date: m.date, startTime: m.startTime, endTime: m.endTime, duration: m.duration, status: m.status, type: "membership" })),
          tournaments: full.tournaments.map((t: any) => ({ date: t.date, startTime: t.startTime, endTime: t.endTime, duration: t.duration, status: t.status, type: "tournament" })),
        };

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Occupancy retrieved successfully",
          result,
        ),
      );
  }),

  // Upload invoice PDF
  uploadInvoice: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { pdfBase64 } = req.body;

    if (!pdfBase64) {
      throw new AppError(400, "PDF content is required");
    }

    const result = await BookingService.uploadInvoice(id, pdfBase64);

    res.status(CONSTANTS.HTTP_STATUS.OK).json(
      ApiResponseUtil.success(
        CONSTANTS.HTTP_STATUS.OK,
        "Invoice uploaded successfully",
        result,
      ),
    );
  }),
};

export default bookingController;
