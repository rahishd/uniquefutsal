// Membership Plans API Client

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  perks: string[];
  featured: boolean;
  isActive: boolean;
  pricingMatrix?: PricingMatrix | null; // { duration: { category: discount } }

  // 3x3 Matrix Base Prices
  price3DaysMorning?: number | null;
  price3DaysDay?: number | null;
  price3DaysEvening?: number | null;
  price1MonthMorning?: number | null;
  price1MonthDay?: number | null;
  price1MonthEvening?: number | null;
  price3MonthsMorning?: number | null;
  price3MonthsDay?: number | null;
  price3MonthsEvening?: number | null;

  // 3x3 Matrix Discounts (%)
  discount3DaysMorning?: number | null;
  discount3DaysDay?: number | null;
  discount3DaysEvening?: number | null;
  discount1MonthMorning?: number | null;
  discount1MonthDay?: number | null;
  discount1MonthEvening?: number | null;
  discount3MonthsMorning?: number | null;
  discount3MonthsDay?: number | null;
  discount3MonthsEvening?: number | null;

  createdAt: string;
  updatedAt: string;
}

export interface PricingMatrix {
  [duration: string]: {
    [category: string]: number;
  };
}

export interface MembershipSubscription {
  id: string;
  planId: string;
  plan: MembershipPlan;
  userId: string;
  user?: {
    phoneNumber: string;
    email: string;
    name: string | null;
  };
  startDate: string;
  endDate: string;
  status: string;
  timeSlot?: string;
  paymentStatus: string;
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: string;
  chosenDuration?: string;
  chosenCategory?: string;
  chosenDays?: string[];
  excludeDays?: string[];
  totalPrice?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlotAvailability {
  slot: string;
  available: boolean;
  capacity: number;
  reserved: number;
}

export interface MembershipSettlementSummary {
  bookingId: string;
  basePrice: number;
  totalPrice: number;
  amountPaidNow: number;
  cashAmount: number;
  onlineAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  waterBottles: number;
  addOns: string;
  addOnsPrice: number;
  paymentHistory?: Array<{
    at: string;
    cashAmount: number;
    onlineAmount: number;
    totalAmount: number;
  }>;
  paidHistoryExpression?: string;
}

export interface CreatePlanData {
  name: string;
  description?: string;
  price: number;
  perks: string[];
  featured?: boolean;
  pricingMatrix?: string;

  price3DaysMorning?: number;
  price3DaysDay?: number;
  price3DaysEvening?: number;
  price1MonthMorning?: number;
  price1MonthDay?: number;
  price1MonthEvening?: number;
  price3MonthsMorning?: number;
  price3MonthsDay?: number;
  price3MonthsEvening?: number;

  discount3DaysMorning?: number;
  discount3DaysDay?: number;
  discount3DaysEvening?: number;
  discount1MonthMorning?: number;
  discount1MonthDay?: number;
  discount1MonthEvening?: number;
  discount3MonthsMorning?: number;
  discount3MonthsDay?: number;
  discount3MonthsEvening?: number;
}

export interface UpdatePlanData extends Partial<CreatePlanData> {
  isActive?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const isAdminRoute = window.location.pathname.startsWith("/uniquesuperadmin");
  const token = isAdminRoute
    ? localStorage.getItem("admin_token") || localStorage.getItem("token")
    : localStorage.getItem("token") || localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
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

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Too many requests from this IP. Please wait a few minutes and try again.");
      }

      let errorMsg = `Request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorMsg;
      } catch {
        // Not JSON
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ======================
// PLANS API
// ======================

export async function getPlans(includeInactive = false): Promise<MembershipPlan[]> {
  const query = includeInactive ? "?includeInactive=true" : "";
  const response = await apiCall<MembershipPlan[]>(`/membership/plans${query}`);
  return response.data || [];
}

export async function getPlanById(id: string): Promise<MembershipPlan> {
  const response = await apiCall<MembershipPlan>(`/membership/plans/${id}`);
  if (!response.data) {
    throw new Error("Plan not found");
  }
  return response.data;
}

export async function createPlan(data: CreatePlanData): Promise<MembershipPlan> {
  const response = await apiCall<MembershipPlan>("/membership/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.data) {
    throw new Error("Failed to create plan");
  }
  return response.data;
}

export async function updatePlan(
  id: string,
  data: UpdatePlanData
): Promise<MembershipPlan> {
  const response = await apiCall<MembershipPlan>(`/membership/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.data) {
    throw new Error("Failed to update plan");
  }
  return response.data;
}

export async function deletePlan(id: string): Promise<void> {
  await apiCall(`/membership/plans/${id}`, {
    method: "DELETE",
  });
}

export async function setFeaturedPlan(id: string): Promise<MembershipPlan> {
  const response = await apiCall<MembershipPlan>(
    `/membership/plans/${id}/featured`,
    {
      method: "POST",
    }
  );
  if (!response.data) {
    throw new Error("Failed to set featured plan");
  }
  return response.data;
}

// ======================
// SUBSCRIPTIONS API
// ======================

export async function getMySubscription(): Promise<MembershipSubscription | null> {
  try {
    const response = await apiCall<MembershipSubscription>(
      "/membership/subscriptions/me",
      {}
    );
    return response.data || null;
  } catch (error: unknown) {
    // 404 is expected when user has no active subscription
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

export async function getMySubscriptionHistory(): Promise<MembershipSubscription[]> {
  const response = await apiCall<MembershipSubscription[]>(
    "/membership/subscriptions/history",
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data || [];
}

export async function subscribe(
  planId: string,
  timeSlot?: string,
  startDate?: string,
  chosenDuration?: string,
  chosenCategory?: string,
  totalPrice?: number,
  chosenDays?: string[],
  promoCode?: string
): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    "/membership/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        planId,
        timeSlot,
        startDate,
        chosenDuration,
        chosenCategory,
        totalPrice,
        chosenDays,
        promoCode
      }),
    }
  );
  if (!response.data) {
    throw new Error("Failed to subscribe");
  }
  return response.data;
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    `/membership/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: getAuthHeaders(),
    }
  );
  if (!response.data) {
    throw new Error("Failed to cancel subscription");
  }
  return response.data;
}

export async function getAllSubscriptions(): Promise<MembershipSubscription[]> {
  const response = await apiCall<MembershipSubscription[]>(
    "/membership/subscriptions",
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data || [];
}

export async function checkPlanAvailability(
  planId: string
): Promise<boolean> {
  const response = await apiCall<{ available: boolean }>(
    `/membership/plans/${planId}/availability`,
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data?.available ?? true;
}

// ======================
// TIME SLOTS API
// ======================

export async function getAvailableTimeSlots(startDate?: string): Promise<TimeSlotAvailability[]> {
  const url = startDate
    ? `/membership/timeslots?startDate=${encodeURIComponent(startDate)}`
    : "/membership/timeslots";
  const response = await apiCall<TimeSlotAvailability[]>(url);
  return response.data || [];
}

export async function manualSubscribe(data: any): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    "/membership/subscriptions/manual",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  if (!response.data) {
    throw new Error("Failed to add manual membership");
  }
  return response.data;
}

// ======================
// ADMIN API
// ======================

export async function verifyPayment(subscriptionId: string, sendSms: boolean = true): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    "/membership/subscriptions/verify-payment",
    {
      method: "POST",
      body: JSON.stringify({ subscriptionId, sendSms }),
    }
  );
  if (!response.data) {
    throw new Error("Failed to verify payment");
  }
  return response.data;
}

export async function getPendingSubscriptions(): Promise<MembershipSubscription[]> {
  const response = await apiCall<MembershipSubscription[]>(
    "/membership/subscriptions?filter=pending",
    {
      headers: getAuthHeaders(),
    }
  );
  return response.data || [];
}

export async function deleteSubscription(subscriptionId: string): Promise<void> {
  await apiCall(`/membership/subscriptions/${subscriptionId}`, {
    method: "DELETE",
  });
}

export async function updateSubscription(
  subscriptionId: string,
  data: Partial<MembershipSubscription>
): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    `/membership/subscriptions/${subscriptionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
  if (!response.data) {
    throw new Error("Failed to update subscription");
  }
  return response.data;
}

export async function renewSubscription(
  subscriptionId: string
): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    `/membership/subscriptions/${subscriptionId}/renew`,
    {
      method: "POST",
    }
  );
  if (!response.data) {
    throw new Error("Failed to renew subscription");
  }
  return response.data;
}

export async function uploadMembershipInvoice(
  id: string,
  pdfBase64: string,
): Promise<{ invoiceUrl: string }> {
  const response = await apiCall<{ invoiceUrl: string }>(
    `/membership/subscriptions/${id}/invoice`,
    {
      method: "POST",
      body: JSON.stringify({ pdfBase64 }),
    },
  );

  if (!response.data) {
    throw new Error("Failed to upload membership invoice");
  }

  return response.data;
}

export async function settlePayment(
  subscriptionId: string,
  data: {
    method: "cash" | "online" | "partial";
    cashAmount: number;
    onlineAmount: number;
    waterBottles?: number;
    addOns?: string;
    addOnsPrice?: number;
  }
): Promise<MembershipSubscription> {
  const response = await apiCall<MembershipSubscription>(
    `/membership/subscriptions/${subscriptionId}/settle-payment`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  if (!response.data) {
    throw new Error("Failed to settle payment");
  }

  return response.data;
}

export async function getSettlementSummary(
  subscriptionId: string,
): Promise<MembershipSettlementSummary> {
  const response = await apiCall<MembershipSettlementSummary>(
    `/membership/subscriptions/${subscriptionId}/settlement-summary`,
    {
      method: "GET",
    },
  );

  if (!response.data) {
    throw new Error("Failed to load settlement summary");
  }

  return response.data;
}
