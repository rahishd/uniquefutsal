export interface CreateTournamentDTO {
  name: string;
  prizePool: number;
  firstPrize?: string;
  secondPrize?: string;
  thirdPrize?: string;
  organizerName?: string;
  minTeams: number;
  maxTeams: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  bookedHours?: number;
  hourlyRate?: number;
  advancePayment?: number;
  hasMineralWater?: boolean;
  waterQuantity?: number;
  waterUnitPrice?: number;
  waterCharge?: number;
  hasSkyRoofSpectator?: boolean;
  skyRoofCharge?: number;
  hasHealthInsurance?: boolean;
  insurancePercent?: number;
  insuranceCharge?: number;
  subTotal?: number;
  totalAmount?: number;
  registeredDate?: string;
  isActive?: boolean;
  description?: string;
  dailySchedules?: string;
  groundTotal?: number;
  paymentStatus?: string;
}

export interface UpdateTournamentDTO {
  name?: string;
  prizePool?: number;
  firstPrize?: string;
  secondPrize?: string;
  thirdPrize?: string;
  organizerName?: string;
  minTeams?: number;
  maxTeams?: number;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  bookedHours?: number;
  hourlyRate?: number;
  advancePayment?: number;
  hasMineralWater?: boolean;
  waterQuantity?: number;
  waterUnitPrice?: number;
  waterCharge?: number;
  hasSkyRoofSpectator?: boolean;
  skyRoofCharge?: number;
  hasHealthInsurance?: boolean;
  insurancePercent?: number;
  insuranceCharge?: number;
  subTotal?: number;
  totalAmount?: number;
  registeredDate?: string;
  isActive?: boolean;
  description?: string;
  dailySchedules?: string;
  groundTotal?: number;
  paymentStatus?: string;
}

export interface TournamentResponse {
  id: string;
  name: string;
  prizePool: number;
  firstPrize: string | null;
  secondPrize: string | null;
  thirdPrize: string | null;
  organizerName: string | null;
  minTeams: number;
  maxTeams: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  bookedHours: number;
  hourlyRate: number;
  advancePayment: number;
  hasMineralWater: boolean;
  waterQuantity: number;
  waterUnitPrice: number;
  waterCharge: number;
  hasSkyRoofSpectator: boolean;
  skyRoofCharge: number;
  hasHealthInsurance: boolean;
  insurancePercent: number;
  insuranceCharge: number;
  subTotal: number;
  totalAmount: number;
  registeredDate: string | null;
  isActive: boolean;
  dailySchedules: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRegistrationDTO {
  tournamentId: string;
  teamName: string;
  captainName: string;
  contactEmail: string;
  contactPhone: string;
  players: string[]; // Array of player names
}

export interface RegistrationResponse {
  id: string;
  tournamentId: string;
  teamName: string;
  captainName: string;
  contactEmail: string;
  contactPhone: string;
  players: string[]; // Parsed array
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
