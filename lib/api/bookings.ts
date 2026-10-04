// Bookings API Client

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const normalizeDateForApi = (value: string): string => {
  if (!value) return "";

  const trimmed = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (trimmed.includes("T")) return trimmed.split("T")[0];

  return "";
};

export interface Booking {
  id: string;
  userId?: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  basePrice: number;
  addOns?: string;
  addOnsPrice: number;
  waterBottles: number;
  promoCode?: string;
  discountAmount: number;
  subtotal: number;
  totalPrice: number;
  paymentMethod: string;
  amountPaidNow: number;
  cashAmount: number;
  onlineAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loyaltyEnabled?: boolean;
}

export interface CreateBookingData {
  date: string;
  startTime: string;
  duration: number;
  addOns?: string;
  addOnsPrice?: number;
  waterBottles?: number;
  promoCode?: string;
  discountAmount?: number;
  paymentMethod: "full" | "advance" | "venue";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  overridePrice?: number;
  /** NEW – enable/disable loyalty points for this booking */
  loyaltyEnabled?: boolean;
  useFreeMatch?: boolean;
}

export interface BookingFilters {
  date?: string;
  status?: string;
  userId?: string;
  search?: string;
  paymentStatus?: "paid" | "due";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
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
  const token =
    localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const fullRequest = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
        ...options?.headers,
      },
    };

    const response = await fetch(url, fullRequest);

    // Check for rate limiting or other non-OK status before parsing JSON
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(
          "Too many requests from this IP. Please wait a few minutes and try again.",
        );
      }

      try {
        const errorData = await response.json();
        const msg = Array.isArray(errorData.message) 
          ? errorData.message.join(', ') 
          : errorData.message;
        throw new Error(msg || `API Error (${response.status})`);
      } catch (err) {
        if (err instanceof Error && err.message !== "Unexpected end of JSON input") {
          throw err;
        }
        throw new Error(`Request failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// ======================
// BOOKINGS API
// ======================

export async function createBooking(
  bookingData: CreateBookingData,
): Promise<Booking> {
  const normalizedDate = normalizeDateForApi(bookingData.date);

  if (!normalizedDate) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  const payload = {
    ...bookingData,
    date: normalizedDate,
  };

  const response = await apiCall<Booking>("/bookings", {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new Error("Failed to create booking");
  }

  return response.data;
}

export async function getBookings(
  filters?: BookingFilters,
): Promise<Booking[]> {
  const queryParams = new URLSearchParams();
  if (filters?.date) queryParams.append("date", filters.date);
  if (filters?.status) queryParams.append("status", filters.status);
  if (filters?.userId) queryParams.append("userId", filters.userId);
  if (filters?.search) queryParams.append("search", filters.search);
  if (filters?.paymentStatus)
    queryParams.append("paymentStatus", filters.paymentStatus);

  const queryString = queryParams.toString();
  const endpoint = `/bookings${queryString ? `?${queryString}` : ""}`;

  const response = await apiCall<Booking[]>(endpoint, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  return response.data || [];
}

export interface GetBookingsPaginatedParams {
  filters?: BookingFilters;
  page?: number;
  limit?: number;
}

export async function getBookingsPaginated(
  params?: GetBookingsPaginatedParams,
): Promise<PaginatedResponse<Booking>> {
  const queryParams = new URLSearchParams();
  if (params?.filters?.date) queryParams.append("date", params.filters.date);
  if (params?.filters?.status)
    queryParams.append("status", params.filters.status);
  if (params?.filters?.userId)
    queryParams.append("userId", params.filters.userId);
  if (params?.filters?.search)
    queryParams.append("search", params.filters.search);
  if (params?.filters?.paymentStatus)
    queryParams.append("paymentStatus", params.filters.paymentStatus);
  if (params?.page) queryParams.append("page", String(params.page));
  if (params?.limit) queryParams.append("limit", String(params.limit));

  const queryString = queryParams.toString();
  const endpoint = `/bookings${queryString ? `?${queryString}` : ""}`;

  const response = await apiCall<PaginatedResponse<Booking>>(endpoint, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  return (
    response.data || {
      items: [],
      meta: { page: 1, limit: params?.limit ?? 10, total: 0, totalPages: 1 },
    }
  );
}

export async function getBookingById(id: string): Promise<Booking> {
  const response = await apiCall<Booking>(`/bookings/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.data) {
    throw new Error("Booking not found");
  }

  return response.data;
}

export async function updateBooking(
  id: string,
  updates: {
    status?: "pending" | "confirmed" | "cancelled" | "completed";
    paymentStatus?: "pending" | "completed" | "partially_paid";
    notes?: string;
    cashAmount?: number;
    onlineAmount?: number;
    waterBottles?: number;
    addOns?: string;
    addOnsPrice?: number;
    totalPrice?: number;
    sendSms?: boolean;
    settlePreviousDues?: boolean;
    loyaltyEnabled?: boolean;
  },
): Promise<Booking> {
  const response = await apiCall<Booking>(`/bookings/${id}`, {
    method: "PATCH",
    headers: {
      ...getAuthHeaders(),
    },
    body: JSON.stringify(updates),
  });

  if (!response.data) {
    throw new Error("Failed to update booking");
  }

  return response.data;
}

export async function cancelBooking(id: string): Promise<Booking> {
  const response = await apiCall<Booking>(`/bookings/${id}/cancel`, {
    method: "POST",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.data) {
    throw new Error("Failed to cancel booking");
  }

  return response.data;
}

export async function deleteBooking(id: string, sendSms: boolean = true): Promise<void> {
  await apiCall(`/bookings/${id}${sendSms ? "" : "?sendSms=false"}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders(),
    },
  });
}

export async function getAvailableSlots(
  date: string,
  duration: number = 1,
): Promise<string[]> {
  const normalizedDate = normalizeDateForApi(date);
  const response = await apiCall<{ slots: string[] }>(
    `/bookings/available?date=${normalizedDate}&duration=${duration}`,
    {
      headers: {
        ...getAuthHeaders(),
      },
    },
  );

  return response.data?.slots || [];
}

export interface OccupancyResponse {
  bookings: Booking[];
  memberships: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    customerName: string;
    customerPhone: string;
    status: string;
    type: string;
  }[];
  tournaments?: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    customerName: string;
    customerPhone: string;
    status: string;
    type: string;
  }[];
}

export async function getOccupancy(date: string): Promise<OccupancyResponse> {
  const normalizedDate = normalizeDateForApi(date);
  const response = await apiCall<OccupancyResponse>(
    `/bookings/occupancy?date=${normalizedDate}`,
    {
      headers: {
        ...getAuthHeaders(),
      },
    },
  );

  return response.data || { bookings: [], memberships: [] };
}

export async function uploadInvoice(
  id: string,
  pdfBase64: string,
 ): Promise<{ invoiceUrl: string }> {
  const response = await apiCall<{ invoiceUrl: string }>(
    `/bookings/${id}/invoice`,
    {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ pdfBase64 }),
    },
  );

  if (!response.data) {
    throw new Error("Failed to upload invoice");
  }

  return response.data;
}
