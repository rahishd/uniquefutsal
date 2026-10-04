const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export interface AuditLogUser {
  id: string;
  name: string | null;
  email: string;
  phoneNumber: string;
  role: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  changes: string | null;
  userId: string | null;
  user: AuditLogUser | null;
  timestamp: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export const auditApi = {
  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    entity?: string;
    userId?: string;
    search?: string;
  } = {}): Promise<AuditLogsResponse> {
    const url = new URL(`${API_BASE_URL}/audit`);
    
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.action) url.searchParams.append("action", params.action);
    if (params.entity) url.searchParams.append("entity", params.entity);
    if (params.userId) url.searchParams.append("userId", params.userId);
    if (params.search) url.searchParams.append("search", params.search);

    const res = await fetch(url.toString(), {
      headers: { ...getAuthHeaders() },
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || "Failed to fetch audit logs");
    }

    return json as AuditLogsResponse;
  },

  async getFilters(): Promise<{ success: boolean; data: { actions: string[]; entities: string[] } }> {
    const res = await fetch(`${API_BASE_URL}/audit/filters`, {
      headers: { ...getAuthHeaders() },
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.message || "Failed to fetch audit log filters");
    }

    return json;
  }
};
