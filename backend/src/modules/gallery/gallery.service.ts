import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import {
  CreateGalleryDTO,
  UpdateGalleryDTO,
  GalleryResponse,
} from "./gallery.dto";
import logger from "../../config/logger";
import { uploadBase64ToR2 } from "../../utils/r2storage";

export class GalleryService {
  async getAllGalleryItems(
    onlyActive: boolean = false,
  ): Promise<GalleryResponse[]> {
    try {
      const where = onlyActive ? { isActive: true } : {};
      return await prisma.gallery.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error fetching gallery items:", error);
      throw new AppError(500, "Failed to fetch gallery items");
    }
  }

  async getGalleryItemById(id: string): Promise<GalleryResponse> {
    const item = await prisma.gallery.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError(404, "Gallery item not found");
    }

    return item;
  }

  async createGalleryItem(dto: CreateGalleryDTO): Promise<GalleryResponse> {
    try {
      let imageUrl = dto.image;
      if (dto.image.startsWith("data:")) {
        const key = `gallery/item_${Date.now()}`;
        imageUrl = await uploadBase64ToR2(dto.image, key);
        logger.info(`Gallery image uploaded to R2: ${imageUrl}`);
      }

      return await prisma.gallery.create({
        data: {
          image: imageUrl,
          title: dto.title,
          description: dto.description,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      logger.error("Error creating gallery item:", error);
      throw new AppError(500, "Failed to create gallery item");
    }
  }

  async updateGalleryItem(
    id: string,
    dto: UpdateGalleryDTO,
  ): Promise<GalleryResponse> {
    try {
      const updateData: any = { ...dto };
      if (dto.image && dto.image.startsWith("data:")) {
        const key = `gallery/item_${id}_${Date.now()}`;
        updateData.image = await uploadBase64ToR2(dto.image, key);
        logger.info(
          `Gallery image updated and uploaded to R2: ${updateData.image}`,
        );
      }

      return await prisma.gallery.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      logger.error("Error updating gallery item:", error);
      throw new AppError(500, "Failed to update gallery item");
    }
  }

  async deleteGalleryItem(id: string): Promise<void> {
    try {
      await prisma.gallery.delete({
        where: { id },
      });
    } catch (error) {
      logger.error("Error deleting gallery item:", error);
      throw new AppError(500, "Failed to delete gallery item");
    }
  }
}

export default new GalleryService();
