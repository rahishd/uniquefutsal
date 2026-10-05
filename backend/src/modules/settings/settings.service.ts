import { prisma } from "../../config/db";
import { AppError } from "../../middlewares/error.middleware";
import {
  SettingsData,
  UpdateSettingsDTO,
  SettingsResponse,
  HourlyPricingSlot,
} from "./settings.dto";
import logger from "../../config/logger";

// Generate default hourly pricing schedule
const generateDefaultHourlyPricing = (): HourlyPricingSlot[] => {
  return Array.from({ length: 17 }, (_, i) => {
    const hour = i + 5;
    const timeStr = `${hour.toString().padStart(2, "0")}:00 - ${(hour + 1).toString().padStart(2, "0")}:00`;
    const defaultPrice = (hour >= 5 && hour < 9) || hour >= 17 ? 1500 : 1000;

    return {
      id: `ts-${hour}`,
      time: timeStr,
      price: defaultPrice,
      isPeak: defaultPrice >= 1500,
    };
  });
};

// Default settings
const DEFAULT_SETTINGS: SettingsData = {
  hourlyRate: 45,
  advanceDeposit: 500,
  timeSlots: [
    "05:00",
    "06:00",
    "07:00",
    "08:00",
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
    "18:00",
    "19:00",
    "20:00",
    "21:00",
  ],
  addOns: [
    { id: "bibs", name: "Team Bibs (Set of 10)", price: 5 },
    { id: "ball", name: "Premium Match Ball", price: 3 },
    { id: "water", name: "Hydration Pack (10x 500ml)", price: 12 },
  ],
  promoCodes: [],
  hourlyPricing: generateDefaultHourlyPricing(),
};

export class SettingsService {
  // Get a setting by key
  private async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
      where: { key },
    });
    return setting?.value || null;
  }

  // Set a setting by key
  private async setSetting(key: string, value: string): Promise<void> {
    await prisma.settings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // Get all settings
  async getSettings(): Promise<SettingsResponse> {
    try {
      // Fetch individual settings
      const hourlyRateStr = await this.getSetting("hourlyRate");
      const advanceDepositStr = await this.getSetting("advanceDeposit");
      const timeSlotsStr = await this.getSetting("timeSlots");
      const addOnsStr = await this.getSetting("addOns");
      const promoCodesStr = await this.getSetting("promoCodes");
      const hourlyPricingStr = await this.getSetting("hourlyPricing");
      const wifiSSID = await this.getSetting("wifiSSID");
      const wifiPassword = await this.getSetting("wifiPassword");

      // Parse settings or use defaults
      const settings: SettingsData = {
        hourlyRate: hourlyRateStr
          ? parseFloat(hourlyRateStr)
          : DEFAULT_SETTINGS.hourlyRate,
        advanceDeposit: advanceDepositStr
          ? parseFloat(advanceDepositStr)
          : DEFAULT_SETTINGS.advanceDeposit,
        timeSlots: timeSlotsStr
          ? JSON.parse(timeSlotsStr)
          : DEFAULT_SETTINGS.timeSlots,
        addOns: addOnsStr ? JSON.parse(addOnsStr) : DEFAULT_SETTINGS.addOns,
        promoCodes: promoCodesStr
          ? JSON.parse(promoCodesStr)
          : DEFAULT_SETTINGS.promoCodes,
        hourlyPricing: hourlyPricingStr
          ? JSON.parse(hourlyPricingStr)
          : DEFAULT_SETTINGS.hourlyPricing,
        wifiSSID: wifiSSID || undefined,
        wifiPassword: wifiPassword || undefined,
      };

      // Get latest update time
      const latestSetting = await prisma.settings.findFirst({
        orderBy: { updatedAt: "desc" },
      });

      return {
        settings,
        updatedAt: latestSetting?.updatedAt || new Date(),
      };
    } catch (error) {
      logger.error("Error fetching settings:", error);
      // Return defaults if database error
      return {
        settings: DEFAULT_SETTINGS,
        updatedAt: new Date(),
      };
    }
  }

  // Update settings
  async updateSettings(dto: UpdateSettingsDTO): Promise<SettingsResponse> {
    try {
      // Update individual settings
      if (dto.hourlyRate !== undefined) {
        await this.setSetting("hourlyRate", dto.hourlyRate.toString());
      }

      if (dto.advanceDeposit !== undefined) {
        await this.setSetting("advanceDeposit", dto.advanceDeposit.toString());
      }

      if (dto.timeSlots !== undefined) {
        await this.setSetting("timeSlots", JSON.stringify(dto.timeSlots));
      }

      if (dto.addOns !== undefined) {
        await this.setSetting("addOns", JSON.stringify(dto.addOns));
      }

      if (dto.promoCodes !== undefined) {
        await this.setSetting("promoCodes", JSON.stringify(dto.promoCodes));
      }

      if (dto.hourlyPricing !== undefined) {
        await this.setSetting("hourlyPricing", JSON.stringify(dto.hourlyPricing));
      }

      if (dto.wifiSSID !== undefined) {
        await this.setSetting("wifiSSID", dto.wifiSSID);
      }

      if (dto.wifiPassword !== undefined) {
        await this.setSetting("wifiPassword", dto.wifiPassword);
      }

      logger.info("Settings updated successfully");

      // Return updated settings
      return await this.getSettings();
    } catch (error) {
      logger.error("Error updating settings:", error);
      throw new AppError(500, "Failed to update settings");
    }
  }

  // Get hourly rate
  async getHourlyRate(): Promise<number> {
    const hourlyRateStr = await this.getSetting("hourlyRate");
    return hourlyRateStr
      ? parseFloat(hourlyRateStr)
      : DEFAULT_SETTINGS.hourlyRate;
  }

  // Get advance deposit amount
  async getAdvanceDeposit(): Promise<number> {
    const advanceDepositStr = await this.getSetting("advanceDeposit");
    return advanceDepositStr
      ? parseFloat(advanceDepositStr)
      : DEFAULT_SETTINGS.advanceDeposit;
  }

  // Get time slots
  async getTimeSlots(): Promise<string[]> {
    const timeSlotsStr = await this.getSetting("timeSlots");
    return timeSlotsStr ? JSON.parse(timeSlotsStr) : DEFAULT_SETTINGS.timeSlots;
  }

  // Get add-ons
  async getAddOns(): Promise<typeof DEFAULT_SETTINGS.addOns> {
    const addOnsStr = await this.getSetting("addOns");
    return addOnsStr ? JSON.parse(addOnsStr) : DEFAULT_SETTINGS.addOns;
  }

  // Get promo codes
  async getPromoCodes(): Promise<typeof DEFAULT_SETTINGS.promoCodes> {
    const promoCodesStr = await this.getSetting("promoCodes");
    return promoCodesStr
      ? JSON.parse(promoCodesStr)
      : DEFAULT_SETTINGS.promoCodes;
  }

  // Get hourly pricing schedule
  async getHourlyPricing(): Promise<HourlyPricingSlot[]> {
    const hourlyPricingStr = await this.getSetting("hourlyPricing");
    return hourlyPricingStr
      ? JSON.parse(hourlyPricingStr)
      : DEFAULT_SETTINGS.hourlyPricing || generateDefaultHourlyPricing();
  }

  // Get add-on pricing map
  async getAddOnsPricingMap(): Promise<Record<string, number>> {
    const addOns = await this.getAddOns();
    return addOns.reduce(
      (map, addon) => {
        map[addon.id] = addon.price;
        return map;
      },
      {} as Record<string, number>,
    );
  }

  // Initialize default settings (for first-time setup)
  async initializeDefaultSettings(): Promise<void> {
    try {
      const existingSettings = await prisma.settings.findFirst();

      if (!existingSettings) {
        await this.updateSettings(DEFAULT_SETTINGS);
        logger.info("Default settings initialized");
      }
    } catch (error) {
      logger.error("Error initializing default settings:", error);
    }
  }
}

export default new SettingsService();
