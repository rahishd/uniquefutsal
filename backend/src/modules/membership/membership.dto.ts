import { IsString, IsOptional, IsNumber, IsArray, IsBoolean } from 'class-validator';

export class CreateMembershipPlanDTO {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  price!: number;

  @IsArray()
  @IsString({ each: true })
  perks!: string[];

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsString()
  @IsOptional()
  pricingMatrix?: string;

  @IsNumber() @IsOptional() price3DaysMorning?: number;
  @IsNumber() @IsOptional() price3DaysDay?: number;
  @IsNumber() @IsOptional() price3DaysEvening?: number;
  @IsNumber() @IsOptional() price1MonthMorning?: number;
  @IsNumber() @IsOptional() price1MonthDay?: number;
  @IsNumber() @IsOptional() price1MonthEvening?: number;
  @IsNumber() @IsOptional() price3MonthsMorning?: number;
  @IsNumber() @IsOptional() price3MonthsDay?: number;
  @IsNumber() @IsOptional() price3MonthsEvening?: number;

  @IsNumber() @IsOptional() discount3DaysMorning?: number;
  @IsNumber() @IsOptional() discount3DaysDay?: number;
  @IsNumber() @IsOptional() discount3DaysEvening?: number;
  @IsNumber() @IsOptional() discount1MonthMorning?: number;
  @IsNumber() @IsOptional() discount1MonthDay?: number;
  @IsNumber() @IsOptional() discount1MonthEvening?: number;
  @IsNumber() @IsOptional() discount3MonthsMorning?: number;
  @IsNumber() @IsOptional() discount3MonthsDay?: number;
  @IsNumber() @IsOptional() discount3MonthsEvening?: number;
}

export class UpdateMembershipPlanDTO {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  perks?: string[];

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

  @IsString()
  @IsOptional()
  pricingMatrix?: string;

  @IsNumber() @IsOptional() price3DaysMorning?: number;
  @IsNumber() @IsOptional() price3DaysDay?: number;
  @IsNumber() @IsOptional() price3DaysEvening?: number;
  @IsNumber() @IsOptional() price1MonthMorning?: number;
  @IsNumber() @IsOptional() price1MonthDay?: number;
  @IsNumber() @IsOptional() price1MonthEvening?: number;
  @IsNumber() @IsOptional() price3MonthsMorning?: number;
  @IsNumber() @IsOptional() price3MonthsDay?: number;
  @IsNumber() @IsOptional() price3MonthsEvening?: number;

  @IsNumber() @IsOptional() discount3DaysMorning?: number;
  @IsNumber() @IsOptional() discount3DaysDay?: number;
  @IsNumber() @IsOptional() discount3DaysEvening?: number;
  @IsNumber() @IsOptional() discount1MonthMorning?: number;
  @IsNumber() @IsOptional() discount1MonthDay?: number;
  @IsNumber() @IsOptional() discount1MonthEvening?: number;
  @IsNumber() @IsOptional() discount3MonthsMorning?: number;
  @IsNumber() @IsOptional() discount3MonthsDay?: number;
  @IsNumber() @IsOptional() discount3MonthsEvening?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export interface MembershipPlanResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  perks: string[];
  featured: boolean;
  isActive: boolean;
  pricingMatrix?: string | null;
  price3DaysMorning?: number | null;
  price3DaysDay?: number | null;
  price3DaysEvening?: number | null;
  price1MonthMorning?: number | null;
  price1MonthDay?: number | null;
  price1MonthEvening?: number | null;
  price3MonthsMorning?: number | null;
  price3MonthsDay?: number | null;
  price3MonthsEvening?: number | null;

  discount3DaysMorning?: number | null;
  discount3DaysDay?: number | null;
  discount3DaysEvening?: number | null;
  discount1MonthMorning?: number | null;
  discount1MonthDay?: number | null;
  discount1MonthEvening?: number | null;
  discount3MonthsMorning?: number | null;
  discount3MonthsDay?: number | null;
  discount3MonthsEvening?: number | null;

  createdAt: Date;
  updatedAt: Date;
}

export class CreateSubscriptionDTO {
  @IsString()
  planId!: string;

  @IsString()
  @IsOptional()
  timeSlot?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  chosenDuration?: string;

  @IsString()
  @IsOptional()
  chosenCategory?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  chosenDays?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludeDays?: string[];

  @IsNumber()
  @IsOptional()
  totalPrice?: number;

  @IsString()
  @IsOptional()
  promoCode?: string;

  @IsBoolean()
  @IsOptional()
  isManual?: boolean;
}

export interface VerifyPaymentDTO {
  subscriptionId: string;
  adminId: string;
}

export interface SubscriptionResponse {
  id: string;
  planId: string;
  plan: MembershipPlanResponse;
  userId: string;
  startDate: Date;
  endDate: Date;
  status: string;
  timeSlot?: string;
  paymentStatus: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlotAvailability {
  slot: string;
  available: boolean;
  capacity: number;
  reserved: number;
}

export interface GetTimeSlotsDTO {
  startDate?: string; // ISO date string to check availability for specific date range
}
