// Tournaments API Client

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface Tournament {
  id: string;
  name: string;
  prizePool: number;
  firstPrize?: string | null;
  secondPrize?: string | null;
  thirdPrize?: string | null;
  organizerName?: string | null;
  minTeams: number;
  maxTeams: number;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  bookedHours?: number;
  hourlyRate?: number;
  groundTotal?: number;
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
  registeredDate?: string | null;
  isActive: boolean;
  status: "active" | "completed" | "cancelled";
  paymentStatus: "paid" | "unpaid";
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  description: string;
  dailySchedules?: {
    date: string;
    startTime: string;
    endTime: string;
    isOff: boolean;
  }[];
}

export interface Registration {
  id: string;
  tournamentId: string;
  teamName: string;
  captainName: string;
  contactEmail: string;
  contactPhone: string;
  players: string[];
}

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
}

type AgreementMeta = Partial<Pick<Tournament,
  | "firstPrize"
  | "secondPrize"
  | "thirdPrize"
  | "organizerName"
  | "startTime"
  | "endTime"
  | "bookedHours"
  | "hourlyRate"
  | "groundTotal"
  | "advancePayment"
  | "hasMineralWater"
  | "waterQuantity"
  | "waterUnitPrice"
  | "waterCharge"
  | "hasSkyRoofSpectator"
  | "skyRoofCharge"
  | "hasHealthInsurance"
  | "insurancePercent"
  | "insuranceCharge"
  | "subTotal"
  | "totalAmount"
  | "registeredDate"
  | "dailySchedules"
>> & { notes?: string };

const getAuthHeaders = (): Record<string, string> => {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("admin_token") || localStorage.getItem("token")
      : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper function for API calls
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

    if (!response.ok) {
      try {
        const errorData = await response.json();
        const msg = Array.isArray(errorData.message) 
          ? errorData.message.join(', ') 
          : errorData.message;
        throw new Error(msg || `API Error (${response.status})`);
      } catch (err) {
        if (err instanceof Error && err.message !== "Unexpected end of JSON input" && !err.message.includes("is not valid JSON")) {
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
// TOURNAMENTS API
// ======================
function parseTournament(tournament: Tournament): Tournament {
  const rawDescription = tournament.description || "";
  try {
    const parsed = JSON.parse(rawDescription) as {
      agreement?: AgreementMeta;
      notes?: string;
    };
    const agreement = parsed?.agreement || {};
    return {
      ...tournament,
      ...agreement,
      description: agreement.notes || parsed.notes || "",
    };
  } catch {
    return tournament;
  }
}

export async function getTournaments(): Promise<Tournament[]> {
  const response = await apiCall<Tournament[]>("/tournaments", {
    headers: { ...getAuthHeaders() },
  });
  return (response.data || []).map(parseTournament);
}

export async function getActiveTournaments(): Promise<Tournament[]> {
  const all = await getTournaments();
  return all.filter((t) => t.isActive);
}

export async function getTournamentById(id: string): Promise<Tournament | null> {
  const response = await apiCall<Tournament>(`/tournaments/${id}`, {
    headers: { ...getAuthHeaders() },
  });
  return response.data ? parseTournament(response.data) : null;
}

export async function saveTournament(tournament: Tournament): Promise<Tournament> {
  const isUpdate = tournament.id && !tournament.id.startsWith("tourney-");
  
  const endpoint = isUpdate ? `/tournaments/${tournament.id}` : "/tournaments";
  const method = isUpdate ? "PATCH" : "POST";
  
  const payload = isUpdate ? tournament : (({ id: _id, ...rest }) => rest)(tournament);

  const response = await apiCall<Tournament>(endpoint, {
    method,
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new Error("Failed to save tournament");
  }

  return parseTournament(response.data);
}

export async function deleteTournament(id: string): Promise<void> {
  await apiCall(`/tournaments/${id}`, {
    method: "DELETE",
    headers: { ...getAuthHeaders() },
  });
}

export async function completeTournament(id: string): Promise<Tournament> {
  const response = await apiCall<Tournament>(`/tournaments/${id}/complete`, {
    method: "PATCH",
    headers: { ...getAuthHeaders() },
  });

  if (!response.data) {
    throw new Error("Failed to complete tournament");
  }

  return parseTournament(response.data);
}

export async function uploadTournamentInvoice(
  id: string,
  pdfBase64: string,
): Promise<{ invoiceUrl: string }> {
  const response = await apiCall<{ invoiceUrl: string }>(
    `/tournaments/${id}/invoice`,
    {
      method: "POST",
      headers: { ...getAuthHeaders() },
      body: JSON.stringify({ pdfBase64 }),
    },
  );

  if (!response.data) {
    throw new Error("Failed to upload tournament invoice");
  }

  return response.data;
}

// ======================
// REGISTRATIONS API
// ======================

export async function getRegistrations(tournamentId?: string): Promise<Registration[]> {
  const endpoint = tournamentId 
    ? `/tournaments/registrations?tournamentId=${tournamentId}` 
    : "/tournaments/registrations";
    
  const response = await apiCall<Registration[]>(endpoint, {
    headers: { ...getAuthHeaders() },
  });
  
  return response.data || [];
}

export async function submitRegistration(registration: Registration): Promise<Registration> {
  const { id: _id, ...payload } = registration;

  const response = await apiCall<Registration>("/tournaments/registrations", {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });

  if (!response.data) {
    throw new Error("Failed to submit registration");
  }

  return response.data;
}

export async function getAffectedItems(startDate: string, endDate: string, tournamentId?: string): Promise<{
  bookings: any[];
  memberships: any[];
}> {
  const query = new URLSearchParams({ startDate, endDate });
  if (tournamentId) query.append("tournamentId", tournamentId);

  const response = await apiCall<{
    bookings: any[];
    memberships: any[];
  }>(`/tournaments/affected-items?${query.toString()}`, {
    headers: { ...getAuthHeaders() },
  });
  
  if (!response.data) {
    throw new Error("Failed to fetch affected items");
  }
  
  return response.data;
}

export async function applyTournamentActions(actions: any[]): Promise<any> {
  const response = await apiCall("/tournaments/apply-actions", {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify({ actions }),
  });
  
  return response.data;
}
