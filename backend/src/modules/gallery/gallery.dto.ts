export interface CreateGalleryDTO {
  image: string;
  title?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateGalleryDTO {
  image?: string;
  title?: string;
  description?: string;
  isActive?: boolean;
}

export interface GalleryResponse {
  id: string;
  image: string;
  title: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
