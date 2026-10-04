const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const ADMIN_TOKEN_KEY = "admin_token";
const ADMIN_INFO_KEY = "admin_info";

export interface AdminInfo {
  id?: string;
  email: string;
  name?: string | null;
  role: string;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    token: string;
    admin: AdminInfo;
  };
  message?: string;
}

// Login admin
export async function adminLogin(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || "Login failed");
  }

  // Store token and admin info
  if (data.data?.token) {
    localStorage.setItem(ADMIN_TOKEN_KEY, data.data.token);
    localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(data.data.admin));
  }

  return data;
}

// Verify admin token
export async function verifyAdminToken(): Promise<AdminInfo | null> {
  const token = getAdminToken();
  
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/admin/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token invalid, clear storage
      adminLogout();
      return null;
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    adminLogout();
    return null;
  }
}

// Logout admin
export function adminLogout(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_INFO_KEY);
}

// Get stored token
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

// Get stored admin info
export function getAdminInfo(): AdminInfo | null {
  if (typeof window === "undefined") return null;
  const info = localStorage.getItem(ADMIN_INFO_KEY);
  return info ? JSON.parse(info) : null;
}

// Check if admin is authenticated
export function isAdminAuthenticated(): boolean {
  return !!getAdminToken();
}
