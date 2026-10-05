import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import { CreateAdDTO, UpdateAdDTO, AdResponse } from "./ad.dto";
import logger from "../../config/logger";
import { uploadBase64ToR2 } from "../../utils/r2storage";

export class AdService {
  async getAllAds(onlyActive: boolean = false): Promise<AdResponse[]> {
    try {
      const where = onlyActive ? { isActive: true } : {};
      return await prisma.ad.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      logger.error("Error fetching ads:", error);
      throw new AppError(500, "Failed to fetch ads");
    }
  }

  async getAdById(id: string): Promise<AdResponse> {
    const ad = await prisma.ad.findUnique({
      where: { id },
    });

    if (!ad) {
      throw new AppError(404, "Advertisement not found");
    }

    return ad;
  }

  async createAd(dto: CreateAdDTO): Promise<AdResponse> {
    try {
      let imageUrl = dto.image;
      if (dto.image.startsWith("data:")) {
        const key = `ads/ad_${Date.now()}`;
        imageUrl = await uploadBase64ToR2(dto.image, key);
        logger.info(`Ad image uploaded to R2: ${imageUrl}`);
      }

      return await prisma.ad.create({
        data: {
          image: imageUrl,
          link: dto.link,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      logger.error("Error creating ad:", error);
      throw new AppError(500, "Failed to create advertisement");
    }
  }

  async updateAd(id: string, dto: UpdateAdDTO): Promise<AdResponse> {
    try {
      const updateData: any = { ...dto };
      if (dto.image && dto.image.startsWith("data:")) {
        const key = `ads/ad_${id}_${Date.now()}`;
        updateData.image = await uploadBase64ToR2(dto.image, key);
        logger.info(`Ad image updated and uploaded to R2: ${updateData.image}`);
      }

      return await prisma.ad.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      logger.error("Error updating ad:", error);
      throw new AppError(500, "Failed to update advertisement");
    }
  }

  async deleteAd(id: string): Promise<void> {
    try {
      await prisma.ad.delete({
        where: { id },
      });
    } catch (error) {
      logger.error("Error deleting ad:", error);
      throw new AppError(500, "Failed to delete advertisement");
    }
  }
}

export default new AdService();
