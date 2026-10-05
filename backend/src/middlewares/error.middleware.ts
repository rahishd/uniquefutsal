import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";
import { ApiResponseUtil } from "../utils/apiResponse";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorMiddleware = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  logger.error(error);

  if (error instanceof AppError) {
    return res
      .status(error.statusCode)
      .json(ApiResponseUtil.error(error.statusCode, error.message));
  }

  return res
    .status(500)
    .json(ApiResponseUtil.error(500, "Internal server error"));
};

export default errorMiddleware;
