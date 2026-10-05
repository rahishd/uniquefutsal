import { Request, Response, NextFunction } from "express";
import adminService from "./admin.service";

class AdminController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Email and password are required" 
        });
      }
      
      const result = await adminService.login(email, password);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.message === "Invalid credentials") {
          return res.status(401).json({ 
            success: false, 
            message: "Invalid email or password" 
          });
        }
        if (error.message === "Account is disabled") {
          return res.status(403).json({ 
            success: false, 
            message: "Account is disabled. Contact support." 
          });
        }
      }
      next(error);
    }
  }

  async verifyToken(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ 
          success: false, 
          message: "No token provided" 
        });
      }
      
      const token = authHeader.split(" ")[1];
      const adminInfo = await adminService.getAdminInfo(token);
      
      res.status(200).json({
        success: true,
        data: adminInfo
      });
    } catch (error: unknown) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }
  }

  async logout(req: Request, res: Response) {
    // For JWT-based auth, logout is handled client-side by removing the token
    // This endpoint is for any server-side cleanup if needed
    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });
  }
}

export default new AdminController();
