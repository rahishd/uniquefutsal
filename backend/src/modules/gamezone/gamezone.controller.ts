import { Request, Response, NextFunction } from "express";
import gamezoneService from "./gamezone.service";

class GamezoneController {
  async getAllRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const records = await gamezoneService.getAllRecords();
      res.status(200).json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  }

  async createRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await gamezoneService.createRecord(req.body);
      res.status(201).json({ success: true, data: record });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      await gamezoneService.deleteRecord(req.params.id);
      res.status(200).json({ success: true, message: "Record deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  async uploadInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { pdfBase64 } = req.body;
      const result = await gamezoneService.uploadInvoice(id, pdfBase64);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new GamezoneController();
