import { Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiResponseUtil } from "../../utils/apiResponse";
import { AuthRequest } from "../../middlewares/auth.middleware";
import AuthService from "./auth.service";
import { LoginDTO, SignupDTO, UpdateMeDTO, ChangePasswordDTO } from "./auth.dto";
import { CONSTANTS } from "../../config/constants";

export const authController = {
  login: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { identifier, password }: LoginDTO = req.body;

    const result = await AuthService.login({ identifier, password });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Logged in successfully",
          result,
        ),
      );
  }),

  signup: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password, name, phoneNumber }: SignupDTO = req.body;

    const result = await AuthService.signup(
      {
        email,
        password,
        name,
        phoneNumber,
      },
      req.user?.role === "admin" || req.user?.role === "superadmin",
    );

    res
      .status(CONSTANTS.HTTP_STATUS.CREATED)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.CREATED,
          "Account created successfully",
          result,
        ),
      );
  }),

  refreshToken: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { refreshToken } = req.body;

    const result = await AuthService.refreshToken(refreshToken);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Token refreshed successfully",
          result,
        ),
      );
  }),

  logout: asyncHandler(async (req: AuthRequest, res: Response) => {
    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Logged out successfully",
        ),
      );
  }),

  me: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      return res
        .status(CONSTANTS.HTTP_STATUS.UNAUTHORIZED)
        .json(
          ApiResponseUtil.error(
            CONSTANTS.HTTP_STATUS.UNAUTHORIZED,
            "Unauthorized",
          ),
        );
    }

    const user = await AuthService.getMe(req.user.id);

    return res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "User fetched successfully",
          user,
        ),
      );
  }),

  updateMe: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      return res
        .status(CONSTANTS.HTTP_STATUS.UNAUTHORIZED)
        .json(ApiResponseUtil.error(CONSTANTS.HTTP_STATUS.UNAUTHORIZED, "Unauthorized"));
    }

    const { name, avatar }: UpdateMeDTO = req.body;
    const user = await AuthService.updateMe(req.user.id, { name, avatar });

    return res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(ApiResponseUtil.success(CONSTANTS.HTTP_STATUS.OK, "Profile updated successfully", user));
  }),

  verifyOTP: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber, otp } = req.body;
    const result = await AuthService.verifyOTP(phoneNumber, otp);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(ApiResponseUtil.success(CONSTANTS.HTTP_STATUS.OK, "OTP verified successfully", result));
  }),

  resendOTP: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber } = req.body;
    await AuthService.resendOTP(phoneNumber);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(ApiResponseUtil.success(CONSTANTS.HTTP_STATUS.OK, "OTP resent successfully"));
  }),
  forgotPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber } = req.body;
    await AuthService.forgotPassword(phoneNumber);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Reset code sent to your phone",
        ),
      );
  }),

  resetPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber, otp, newPassword } = req.body;
    await AuthService.resetPassword({ phoneNumber, otp, newPassword });

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Password reset successfully",
        ),
      );
  }),

  checkPhone: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { phoneNumber } = req.body;
    const result = await AuthService.checkPhone(phoneNumber);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(
        ApiResponseUtil.success(
          CONSTANTS.HTTP_STATUS.OK,
          "Phone check completed",
          result,
        ),
      );
  }),
  changePassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user?.id) {
      return res
        .status(CONSTANTS.HTTP_STATUS.UNAUTHORIZED)
        .json(ApiResponseUtil.error(CONSTANTS.HTTP_STATUS.UNAUTHORIZED, "Unauthorized"));
    }

    const dto: ChangePasswordDTO = req.body;
    await AuthService.changePassword(req.user.id, dto);

    res
      .status(CONSTANTS.HTTP_STATUS.OK)
      .json(ApiResponseUtil.success(CONSTANTS.HTTP_STATUS.OK, "Password changed successfully"));
  }),
};

export default authController;
