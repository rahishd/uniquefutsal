const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface GamezoneRecord {
  id: string;
  customerName: string;
  customerPhone?: string;
  hours: number;
  rate: number;
  money: number;
  date: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
}

const getAuthHeaders = (): Record<string, string> => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const fullRequest = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, fullRequest);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "API request failed");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

export const getGamezoneRecords = async (): Promise<GamezoneRecord[]> => {
  const response = await apiCall<GamezoneRecord[]>("/gamezone", {
    headers: { ...getAuthHeaders() },
  });
  return response.data || [];
};

export const createGamezoneRecord = async (data: Partial<GamezoneRecord>): Promise<GamezoneRecord> => {
  const response = await apiCall<GamezoneRecord>("/gamezone", {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  if (!response.data) throw new Error("Failed to create record");
  return response.data;
};

export const deleteGamezoneRecord = async (id: string): Promise<void> => {
  await apiCall(`/gamezone/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
};

export const uploadGamezoneInvoice = async (
  id: string,
  pdfBase64: string,
): Promise<{ invoiceUrl: string }> => {
  const response = await apiCall<{ invoiceUrl: string }>(
    `/gamezone/${id}/invoice`,
    {
      method: "POST",
      headers: { ...getAuthHeaders() },
      body: JSON.stringify({ pdfBase64 }),
    },
  );
  if (!response.data) throw new Error("Failed to upload invoice");
  return response.data;
};
