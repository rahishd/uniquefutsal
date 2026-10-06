"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { API_URL } from "@/lib/api";
import { getTokens } from "@/lib/auth-token";

const KEY = "uf_visitor";

// Tells the venue (admin Overview > Website visits) that someone opened a page. Sends only a random id this browser made for itself:
// no name, phone or location. Failures are ignored.
function visitorId(): string | null {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export default function VisitTracker() {
  const path = usePathname();
  useEffect(() => {
    const visitor = visitorId();
    if (!visitor) return;
    const token = getTokens()?.token;
    fetch(`${API_URL}/content/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ visitor }),
      keepalive: true,
    }).catch(() => {});
  }, [path]);
  return null;
}
