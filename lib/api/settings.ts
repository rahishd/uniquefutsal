// Settings API Client

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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

export interface SettingsResponse {
  settings: SettingsData;
  updatedAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  
  // Try admin token first, then fallback to user token
  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
  
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const fullRequest: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    };

    const response = await fetch(url, fullRequest);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Too many requests from this IP. Please wait a few minutes and try again.");
      }
      
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || `API Error (${response.status})`);
      } catch {
        throw new Error(`Request failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);

    if (error instanceof TypeError) {
      throw new Error(
        `Cannot connect to backend at ${url}. Ensure backend server is running and NEXT_PUBLIC_API_URL is correct.`,
      );
    }

    throw error instanceof Error ? error : new Error("API request failed");
  }
}

// ======================
// SETTINGS API
// ======================

export async function getSettings(): Promise<SettingsResponse> {
  const response = await apiCall<SettingsResponse>("/settings");

  if (!response.data) {
    throw new Error("Failed to fetch settings");
  }

  return response.data;
}

export async function updateSettings(
  updates: Partial<SettingsData>,
  token?: string,
): Promise<SettingsResponse> {
  const response = await apiCall<SettingsResponse>("/settings", {
    method: "PATCH",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(updates),
  });

  if (!response.data) {
    throw new Error("Failed to update settings");
  }

  return response.data;
}

export async function initializeSettings(token?: string): Promise<void> {
  await apiCall("/settings/initialize", {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}
