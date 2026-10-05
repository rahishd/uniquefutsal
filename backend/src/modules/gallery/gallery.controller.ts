import { Request, Response, NextFunction } from "express";
import galleryService from "./gallery.service";
import { CreateGalleryDTO, UpdateGalleryDTO } from "./gallery.dto";

export class GalleryController {
  async getAllItems(req: Request, res: Response, next: NextFunction) {
    try {
      const onlyActive = req.query.active === "true" || req.path === "/active";
      const items = await galleryService.getAllGalleryItems(onlyActive);
      res.status(200).json({
        success: true,
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }

  async getItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await galleryService.getGalleryItemById(req.params.id);
      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: CreateGalleryDTO = req.body;
      const item = await galleryService.createGalleryItem(dto);
      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: UpdateGalleryDTO = req.body;
      const item = await galleryService.updateGalleryItem(req.params.id, dto);
      res.status(200).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      await galleryService.deleteGalleryItem(req.params.id);
      res.status(200).json({
        success: true,
        message: "Gallery item deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new GalleryController();
