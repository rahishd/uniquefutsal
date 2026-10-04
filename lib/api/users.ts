const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface UserBooking {
  id: string;
  totalPrice: number;
  amountPaidNow: number;
  remainingAmount: number;
  paymentStatus: string;
  date: string;
  startTime: string;
  status: string;
}

export interface PlayerData {
  phoneNumber: string;
  email: string | null;
  name: string;
  createdAt: string;
  bookings: UserBooking[];
  freeMatchesAvailable: number;
  loyaltyProgress: number;
  loyaltyEligible: boolean;
  lastBookedDate?: string;
  totalMatches?: number;
  totalSpend?: number;
}

export interface PaginatedPlayers {
  players: PlayerData[];
  total: number;
  stats?: {
    totalMatches: number;
    monthlyActiveCount: number;
  };
}

export const usersApi = {
  async getPlayerBookings(phoneNumber: string): Promise<UserBooking[]> {
    const res = await fetch(`${API_BASE_URL}/users/players/${phoneNumber}/bookings`, {
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error("Failed to fetch player bookings");
    const results = await res.json();
    return results.data;
  },

  async claimFreeMatch(phoneNumber: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${phoneNumber}/claim-free-match`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to claim free match");
    }
  },

  async awardFreeMatch(phoneNumber: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${phoneNumber}/award-free-match`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
      },
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to award free match");
    }
  },

  async searchPlayers(q: string): Promise<Pick<PlayerData, "phoneNumber" | "name">[]> {
    const query = q.trim();
    if (!query) return [];
    const res = await fetch(`${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || "Failed to search players");
    }
    return (json.data || []) as Pick<PlayerData, "phoneNumber" | "name">[];
  },

  async getAllPlayers(page: number = 1, limit: number = 7, search?: string): Promise<PaginatedPlayers> {
    let url = `${API_BASE_URL}/users/players?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const res = await fetch(url, {
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) throw new Error("Failed to fetch players");
    const json = await res.json();
    return {
      players: json.data,
      total: json.pagination?.total || json.data.length,
      stats: json.stats
    };
  },

  async deletePlayer(phoneNumber: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${phoneNumber}`, {
      method: "DELETE",
      headers: { ...getAuthHeaders() }
    });
    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to delete player");
    }
  },

  async updatePlayer(oldPhoneNumber: string, data: { name?: string; email?: string; phoneNumber?: string }): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/users/${oldPhoneNumber}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to update player");
    }
  },

  async createPlayer(data: { name: string; email?: string; phoneNumber: string; password?: string }): Promise<PlayerData> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        ...data,
        password: data.password || "Player123!", // Default password if not provided
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || "Failed to create player");
    }
    return json.data.user as PlayerData;
  },

  async sendCustomSms(phoneNumber: string, message: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/notifications/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ phoneNumber, message }),
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.message || "Failed to send SMS");
    }
  }
};
