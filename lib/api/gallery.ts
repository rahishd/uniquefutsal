const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface GalleryItem {
  id: string;
  image: string; // base64 or URL
  title: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    });

    if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       throw new Error(errorData.message || `API Error (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Gallery API Error [${endpoint}]:`, error);
    throw error;
  }
}

export async function getGalleryItems(onlyActive: boolean = false): Promise<GalleryItem[]> {
  const endpoint = onlyActive ? "/gallery/active" : "/gallery";
  const response = await apiCall<GalleryItem[]>(endpoint);
  return response.data || [];
}

export async function createGalleryItem(data: { image: string; title?: string; description?: string; isActive?: boolean }): Promise<GalleryItem> {
  const response = await apiCall<GalleryItem>("/gallery", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error("Failed to create gallery item");
  return response.data;
}

export async function updateGalleryItem(id: string, data: Partial<{ image: string; title: string; description: string; isActive: boolean }>): Promise<GalleryItem> {
  const response = await apiCall<GalleryItem>(`/gallery/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error("Failed to update gallery item");
  return response.data;
}

export async function deleteGalleryItem(id: string): Promise<void> {
  await apiCall(`/gallery/${id}`, {
    method: "DELETE",
  });
}
