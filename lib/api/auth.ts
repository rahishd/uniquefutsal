// Auth API Client

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface SignupData {
  name: string;
  password: string;
  email?: string;
  phoneNumber?: string;
}

export interface LoginData {
  identifier: string; // can be email or phone
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phoneNumber?: string;
    role: string;
    avatar?: string;
    freeMatchesAvailable?: number;
    isVerified?: boolean;
  };
}

export interface MeResponse {
  id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  role: string;
  avatar?: string;
  freeMatchesAvailable?: number;
}

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data?: T;
  error?: string;
}

// Helper function for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || "API request failed");
    }

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}

// ======================
// AUTH API
// ======================

export async function signup(signupData: SignupData): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(signupData),
  });

  // Store token in localStorage ONLY if verified
  if (typeof window !== "undefined" && response.data?.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("refreshToken", response.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }

  if (!response.data) throw new Error("Authentication failed: No data received");
  return response.data;
}

export async function login(loginData: LoginData): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(loginData),
  });

  if (!response.data) {
    throw new Error("Failed to login");
  }

  // Store token in localStorage
  if (typeof window !== "undefined" && response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("refreshToken", response.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }

  return response.data;
}

export async function verifyOTP(phoneNumber: string, otp: string): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phoneNumber, otp }),
  });

  if (!response.data) {
    throw new Error("Verification failed");
  }

  if (typeof window !== "undefined" && response.data.token) {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("refreshToken", response.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }

  return response.data;
}

export async function resendOTP(phoneNumber: string): Promise<void> {
  await apiCall("/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function getMe(): Promise<MeResponse> {
  const token = getStoredToken();

  if (!token) {
    throw new Error("No token found");
  }

  try {
    const response = await apiCall<MeResponse>("/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.data) {
      throw new Error("Failed to fetch user");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(response.data));
    }

    return response.data;
  } catch (error) {
    // If user not found or token invalid, clear localStorage
    if (
      error instanceof Error &&
      (error.message.includes("User not found") ||
        error.message.includes("Invalid token") ||
        error.message.includes("No token provided"))
    ) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
      }
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;

    await apiCall("/auth/logout", {
      method: "POST",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Clear localStorage regardless of API call success
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
    }
  }
}

export async function refreshToken(
  refreshToken: string,
): Promise<AuthResponse> {
  const response = await apiCall<AuthResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.data) {
    throw new Error("Failed to refresh token");
  }

  // Update token in localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem("token", response.data.token);
    localStorage.setItem("refreshToken", response.data.refreshToken);
    localStorage.setItem("user", JSON.stringify(response.data.user));
  }

  return response.data;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function getStoredUser(): AuthResponse["user"] | null {
  if (typeof window === "undefined") return null;
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}

export async function updateMe(data: {
  name?: string;
  avatar?: string;
}): Promise<MeResponse> {
  const token = getStoredToken();
  if (!token) throw new Error("No token found");

  const response = await apiCall<MeResponse>("/auth/me", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });

  if (!response.data) throw new Error("Failed to update profile");

  // Refresh stored user data and notify listeners
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(response.data));
    // Notify components (e.g. Navbar) that the profile has been updated
    window.dispatchEvent(
      new CustomEvent("userProfileUpdated", { detail: response.data }),
    );
  }

  return response.data;
}

export async function forgotPassword(phoneNumber: string): Promise<void> {
  await apiCall("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function resetPassword(data: {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}): Promise<void> {
  await apiCall("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function checkPhone(phoneNumber: string): Promise<{ exists: boolean; name?: string; email?: string; isVerified: boolean }> {
  const response = await apiCall<{ exists: boolean; name?: string; email?: string; isVerified: boolean }>("/auth/check-phone", {
    method: "POST",
    body: JSON.stringify({ phoneNumber }),
  });

  if (!response.data) {
    throw new Error("Failed to check phone number");
  }

  return response.data;
}

export async function changePassword(data: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  const token = getStoredToken();
  if (!token) throw new Error("No token found");

  await apiCall("/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}
