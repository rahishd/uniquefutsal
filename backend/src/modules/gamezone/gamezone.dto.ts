export interface CreateGamezoneDTO {
  customerName: string;
  hours: number;
  rate: number;
  money: number;
  date: string;
  timestamp: string;
}

export interface UpdateGamezoneDTO {
  customerName?: string;
  hours?: number;
  rate?: number;
  money?: number;
  date?: string;
  timestamp?: string;
}
