"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogle } from "@/lib/google";

// Google's own "Sign in with Google" button. onToken receives Google's signed token; the server verifies it.
export default function GoogleButton({ clientId, onToken }: { clientId: string; onToken: (idToken: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);
  useEffect(() => {
    let alive = true;
    loadGoogle()
      .then((g) => {
        if (!alive || !box.current) return;
        g.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) });
        g.accounts.id.renderButton(box.current, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width: 280 });
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [clientId]);
  return error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : <div ref={box} className="flex justify-center" />;
}
