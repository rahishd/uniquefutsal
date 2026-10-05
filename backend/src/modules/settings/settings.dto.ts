// Settings Module - Domain Transfer Object (DTO)

export interface AddOnItem {
  id: string;
  name: string;
  price: number;
  icon?: string;
}

export interface PromoCode {
  code: string;
  type: "percent" | "flat";
  value: number;
  label: string;
  title?: string;
  description?: string;
  expiryDate?: string;
  startTime?: string;
  endTime?: string;
  validDays?: string[];
  isActive?: boolean;
  appliedTo: "booking" | "membership" | "both";
}

export interface HourlyPricingSlot {
  id: string;
  time: string;
  price: number;
  isPeak: boolean;
}

export interface SettingsData {
  hourlyRate: number;
  advanceDeposit: number;
  timeSlots: string[];
  addOns: AddOnItem[];
  promoCodes: PromoCode[];
  hourlyPricing?: HourlyPricingSlot[];
  wifiSSID?: string;
  wifiPassword?: string;
}

export interface UpdateSettingsDTO {
  hourlyRate?: number;
  advanceDeposit?: number;
  timeSlots?: string[];
  addOns?: AddOnItem[];
  promoCodes?: PromoCode[];
  hourlyPricing?: HourlyPricingSlot[];
  wifiSSID?: string;
  wifiPassword?: string;
}

export interface SettingsResponse {
  settings: SettingsData;
  updatedAt: Date;
}
