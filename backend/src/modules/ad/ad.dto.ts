export interface CreateAdDTO {
  image: string;
  link?: string;
  isActive?: boolean;
}

export interface UpdateAdDTO {
  image?: string;
  link?: string;
  isActive?: boolean;
}

export interface AdResponse {
  id: string;
  image: string;
  link: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
