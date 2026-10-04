const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface Ad {
  id: string;
  image: string; // base64 or URL
  link: string | null;
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
    console.error(`Ads API Error [${endpoint}]:`, error);
    throw error;
  }
}

export async function getAds(onlyActive: boolean = false): Promise<Ad[]> {
  const response = await apiCall<Ad[]>(`/ads${onlyActive ? "?onlyActive=true" : ""}`);
  return response.data || [];
}

export async function getActiveAds(): Promise<Ad[]> {
  const response = await apiCall<Ad[]>("/ads/active");
  return response.data || [];
}

export async function createAd(data: { image: string; link?: string; isActive?: boolean }): Promise<Ad> {
  const response = await apiCall<Ad>("/ads", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error("Failed to create ad");
  return response.data;
}

export async function updateAd(id: string, data: Partial<{ image: string; link: string; isActive: boolean }>): Promise<Ad> {
  const response = await apiCall<Ad>(`/ads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error("Failed to update ad");
  return response.data;
}

export async function deleteAd(id: string): Promise<void> {
  await apiCall(`/ads/${id}`, {
    method: "DELETE",
  });
}
