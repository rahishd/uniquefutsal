import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import SettingsService from "./settings.service";
import { UpdateSettingsDTO } from "./settings.dto";
import { CONSTANTS } from "../../config/constants";
import { AuditService } from "../audit";

export const settingsController = {
  // Get all settings
  getSettings: asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await SettingsService.getSettings();
    // This answer is public: the venue Wi-Fi goes only to signed-in customers through GET /wifi.
    delete result.settings.wifiSSID;
    delete result.settings.wifiPassword;

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Settings retrieved successfully",
          result,
        ),
      );
  }),

  // Update settings (Admin only)
  updateSettings: asyncHandler(async (req: AuthRequest, res: Response) => {
    const dto: UpdateSettingsDTO = req.body;

    const result = await SettingsService.updateSettings(dto);

    await AuditService.log({
      action: "UPDATE_SETTINGS",
      entity: "Settings",
      entityId: "system",
      changes: `Updated system settings`,
      userId: req.user?.id,
    });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Settings updated successfully",
          result,
        ),
      );
  }),

  // Initialize default settings
  initializeSettings: asyncHandler(async (req: AuthRequest, res: Response) => {
    await SettingsService.initializeDefaultSettings();

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Default settings initialized successfully",
        ),
      );
  }),
};

export default settingsController;
