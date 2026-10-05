import { uploadFileToR2 } from "../../utils/r2storage";
import fs from "fs";
import path from "path";
import logger from "../../config/logger";
import { AppError } from "../../middlewares/error.middleware";
import { CreateGamezoneDTO, UpdateGamezoneDTO } from "./gamezone.dto";
import prisma from "../../config/db";

class GamezoneService {
  async getAllRecords() {
    return await prisma.gamezoneRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async getRecordById(id: string) {
    return await prisma.gamezoneRecord.findUnique({
      where: { id },
    });
  }

  async createRecord(data: CreateGamezoneDTO) {
    return await prisma.gamezoneRecord.create({
      data: {
        customerName: data.customerName,
        hours: data.hours,
        rate: data.rate,
        money: data.money,
        date: data.date,
        timestamp: data.timestamp,
      },
    });
  }

  async updateRecord(id: string, data: UpdateGamezoneDTO) {
    return await prisma.gamezoneRecord.update({
      where: { id },
      data: {
        customerName: data.customerName,
        hours: data.hours,
        rate: data.rate,
        money: data.money,
        date: data.date,
        timestamp: data.timestamp,
      },
    });
  }

  async deleteRecord(id: string) {
    return await prisma.gamezoneRecord.delete({
      where: { id },
    });
  }

  async uploadInvoice(id: string, pdfBase64: string) {
    const record = await prisma.gamezoneRecord.findUnique({
      where: { id },
    });

    if (!record) {
      throw new AppError(404, "Gamezone record not found");
    }

    // Extract the base64 data (strip data URL prefix if present)
    const base64Data = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;
    
    const buffer = Buffer.from(base64Data, "base64");
    const relativePath = `invoices/GZ-${id.slice(-6).toUpperCase()}_${Date.now()}.pdf`;

    // Fallback to local storage if R2 is not configured
    const isR2Configured = 
      process.env.R2_ENDPOINT && 
      process.env.R2_ACCESS_KEY_ID && 
      process.env.R2_SECRET_ACCESS_KEY && 
      process.env.R2_BUCKET_NAME;

    if (isR2Configured) {
      try {
        const invoiceUrl = await uploadFileToR2(buffer, relativePath, "application/pdf");
        return { invoiceUrl };
      } catch (err) {
        logger.error("R2 Upload failed for Gamezone, falling back to local:", err);
      }
    }

    // Local Storage Fallback
    const absolutePath = path.join(process.cwd(), "uploads", relativePath);
    await fs.promises.writeFile(absolutePath, buffer);
    
    // Determine base URL
    const baseUrl = (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");
    const invoiceUrl = `${baseUrl}/uploads/${relativePath}`;

    return { invoiceUrl };
  }
}

export default new GamezoneService();
