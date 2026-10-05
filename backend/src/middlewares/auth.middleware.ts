import { Request, Response, NextFunction } from "express";
import { JwtUtil } from "../utils/jwt";
import { ApiResponseUtil } from "../utils/apiResponse";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string | null;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json(ApiResponseUtil.error(401, "No token provided"));
    }

    const decoded = JwtUtil.verify(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json(ApiResponseUtil.error(401, "Invalid token"));
  }
};

export const optionalAuthMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      next();
      return;
    }

    const decoded = JwtUtil.verify(token);
    req.user = decoded;
    next();
  } catch (_error) {
    next();
  }
};

export default authMiddleware;
