import { Request, Response, NextFunction } from "express";
import analyticsService from "./analytics.service";

class AnalyticsController {
  async recordPageVisit(req: Request, res: Response, next: NextFunction) {
    try {
      const { page } = req.body;
      const userAgent = req.headers['user-agent'];
      await analyticsService.recordPageVisit(page, userAgent);
      res.status(200).json({ success: true, message: "Page visit recorded" });
    } catch (error) {
      next(error);
    }
  }

  async getPageVisits(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const visitMap = await analyticsService.getPageVisits(days);
      res.status(200).json({ success: true, data: visitMap });
    } catch (error) {
      next(error);
    }
  }

  async uploadDailyReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { pdfBase64 } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ success: false, message: "PDF content is required" });
      }

      const result = await analyticsService.uploadDailyReport(pdfBase64);

      res.status(200).json({ 
        success: true, 
        message: "Daily report uploaded successfully", 
        data: result 
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AnalyticsController();
