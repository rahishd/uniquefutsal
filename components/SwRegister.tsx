"use client";

import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { syncPush } from "@/lib/push";

export default function SwRegister() {
  const session = useSession();
  const registered = Boolean(session?.registered);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return; // avoid stale caches in dev
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  // a signed-in customer who already allowed alerts on this device: keep the server's copy of the subscription current
  useEffect(() => {
    if (registered) void syncPush();
  }, [registered]);
  return null;
}
