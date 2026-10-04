export interface PromoCode {
  id?: string;
  title: string;
  code: string;
  discount: string;
  description: string;
  expiryDate?: string;
  days?: string[];
  startTime?: string;
  endTime?: string;
  isExpired?: boolean;
  isActive?: boolean;
  appliedTo?: "booking" | "membership" | "both";
  value?: number;
  type?: "percent" | "flat";
  label?: string;
}

export const promoCodes: PromoCode[] = [];
