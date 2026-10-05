import { Request, Response, NextFunction } from "express";
import { ApiResponseUtil } from "../utils/apiResponse";
import { AuthRequest } from "./auth.middleware";

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(ApiResponseUtil.error(401, "Unauthorized"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json(ApiResponseUtil.error(403, "Forbidden"));
    }

    next();
  };
};

export default roleMiddleware;
