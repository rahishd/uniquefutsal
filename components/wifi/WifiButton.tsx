"use client";

import { useState } from "react";
import { Wifi as WifiIcon } from "lucide-react";
import { useSession } from "@/lib/session";
import { useOnCellular, wifiStore } from "@/lib/wifi";
import WifiSheet from "@/components/wifi/WifiSheet";

// Wi-Fi icon next to "Hello" on Home. Shown only to signed-in customers and only while staff keep the Wi-Fi switched on
// in the admin portal. A small dot appears when the phone reports it is on mobile data.
export default function WifiButton() {
  const session = useSession();
  const { data } = wifiStore.use();
  const cellular = useOnCellular();
  const [open, setOpen] = useState(false);
  if (!session?.registered || !data?.visible) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Venue Wi-Fi" className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-brand shadow-sm">
        <WifiIcon size={18} />
        {cellular && <span aria-hidden className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-orange-500 ring-2 ring-white" />}
      </button>
      {open && <WifiSheet wifi={data} onClose={() => setOpen(false)} />}
    </>
  );
}
