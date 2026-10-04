"use client";

import { useEffect } from "react";
import { REMINDER_LEAD_MS, fireReminder, loadReminders, markReminderDone } from "@/lib/notifications";

// Fires the "game starts in 1 hour" notice at the right moment while the app is open.
// Reminders missed while the app was closed are shown on the next open, as long as
// the game hasn't started. (Reaching a closed app needs server-sent Web Push.)
export default function ReminderScheduler() {
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];

    function run() {
      timers.forEach(clearTimeout);
      timers = [];
      const now = Date.now();
      for (const r of loadReminders()) {
        if (r.done) continue;
        if (now >= r.startsAt) {
          markReminderDone(r.id); // game already started: nothing useful to say
          continue;
        }
        const fireAt = r.startsAt - REMINDER_LEAD_MS;
        if (now >= fireAt) fireReminder(r);
        else timers.push(setTimeout(() => fireReminder(r), fireAt - now));
      }
    }

    run();
    window.addEventListener("uf-reminders-changed", run);
    document.addEventListener("visibilitychange", run); // timers can drift while a tab sleeps
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("uf-reminders-changed", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);

  return null;
}
