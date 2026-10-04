"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordPageVisit } from "@/lib/api/analytics";

export default function PageTracker() {
  const pathname = usePathname();
  const hasTrackedSession = useRef(false);

  useEffect(() => {
    if (!hasTrackedSession.current) {
      recordPageVisit(pathname || "/");
      hasTrackedSession.current = true;
    }
  }, [pathname]);

  return null;
}
