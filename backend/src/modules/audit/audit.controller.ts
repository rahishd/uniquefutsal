import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import AuditService from "./audit.service";
import { CONSTANTS } from "../../config/constants";
import { AppError } from "../../middlewares/error.middleware";

export const auditController = {
  getLogs: asyncHandler(async (req: AuthRequest, res: Response) => {
    // Only allow admins/superadmins to view audit logs
    if (req.user?.role !== "superadmin" && req.user?.role !== "admin") {
      throw new AppError(403, "Forbidden - Admin access required");
    }

    const { page, limit, entity, action, search } = req.query;

    const pageNumber = page ? parseInt(page as string, 10) : undefined;
    const limitNumber = limit ? parseInt(limit as string, 10) : undefined;

    const result = await AuditService.getLogs({
      page: pageNumber,
      limit: limitNumber,
      entity: entity as string,
      action: action as string,
      search: search as string,
    });

    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  }),

  getFilters: asyncHandler(async (req: AuthRequest, res: Response) => {
    // Only allow admins/superadmins to view audit filters
    if (req.user?.role !== "superadmin" && req.user?.role !== "admin") {
      throw new AppError(403, "Forbidden - Admin access required");
    }

    const filters = await AuditService.getFilters();

    res.status(CONSTANTS.HTTP_STATUS.OK).json({
      success: true,
      data: filters,
    });
  }),
};

export default auditController;
