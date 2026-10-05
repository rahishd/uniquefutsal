import { Request, Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { ApiResponseUtil } from "../utils/apiResponse";

export const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    return res
      .status(400)
      .json(ApiResponseUtil.error(400, firstError.msg || "Validation error"));
  }

  next();
};

export default validateRequest;
