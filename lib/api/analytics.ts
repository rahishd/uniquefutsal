// Analytics API Client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const getAuthHeaders = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("admin_token") || localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function uploadDailyReport(pdfBase64: string): Promise<{ reportUrl: string }> {
  const response = await fetch(`${API_BASE_URL}/analytics/daily-report/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ pdfBase64 }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to upload daily report");
  }

  return data.data;
}

export async function recordPageVisit(page: string = "/"): Promise<void> {
  if (typeof window === "undefined") return;
  
  try {
    // Fire and forget
    fetch(`${API_BASE_URL}/analytics/page-visit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page }),
    }).catch(() => {}); // ignore errors silently
  } catch (error) {
    // silent
  }
}

export async function getPageVisits(days: number = 30): Promise<Record<string, number>> {
  const response = await fetch(`${API_BASE_URL}/analytics/page-visits?days=${days}`, {
    headers: {
      ...getAuthHeaders(),
    }
  });
  
  if (!response.ok) {
    return {};
  }
  
  const data = await response.json();
  return data.data || {};
}
