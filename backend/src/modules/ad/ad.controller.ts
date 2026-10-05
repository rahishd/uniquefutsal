import { Request, Response, NextFunction } from "express";
import adService from "./ad.service";
import logger from "../../config/logger";

export class AdController {
  async getAllAds(req: Request, res: Response, next: NextFunction) {
    try {
      const ads = await adService.getAllAds(false);
      res.status(200).json({
        success: true,
        data: ads,
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveAds(req: Request, res: Response, next: NextFunction) {
    try {
      const ads = await adService.getAllAds(true);
      res.status(200).json({
        success: true,
        data: ads,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAdById(req: Request, res: Response, next: NextFunction) {
    try {
      const ad = await adService.getAdById(req.params.id);
      res.status(200).json({
        success: true,
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  }

  async createAd(req: Request, res: Response, next: NextFunction) {
    try {
      const ad = await adService.createAd(req.body);
      res.status(201).json({
        success: true,
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAd(req: Request, res: Response, next: NextFunction) {
    try {
      const ad = await adService.updateAd(req.params.id, req.body);
      res.status(200).json({
        success: true,
        data: ad,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAd(req: Request, res: Response, next: NextFunction) {
    try {
      await adService.deleteAd(req.params.id);
      res.status(200).json({
        success: true,
        message: "Advertisement deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AdController();
