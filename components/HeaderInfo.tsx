"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import NepaliDate from "nepali-date-converter";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, CalendarDays } from "lucide-react";

// Venue location for the temperature. Defaults to Kathmandu.
const LAT = process.env.NEXT_PUBLIC_VENUE_LAT || "27.7172";
const LON = process.env.NEXT_PUBLIC_VENUE_LON || "85.324";
const PLACE = process.env.NEXT_PUBLIC_VENUE_NAME || "Kathmandu";

function WeatherIcon({ code }: { code: number }) {
  const cls = 'text-amber-500';
  if (code === 0 || code === 1) return <Sun size={22} className={cls} />;
  if (code === 2 || code === 3) return <Cloud size={22} className={cls} />;
  if (code === 45 || code === 48) return <CloudFog size={22} className={cls} />;
  if (code >= 71 && code <= 77) return <CloudSnow size={22} className={cls} />;
  if (code >= 95) return <CloudLightning size={22} className={cls} />;
  return <CloudRain size={22} className={cls} />;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const noopSubscribe = () => () => {};

export default function HeaderInfo() {
  const key = useSyncExternalStore(noopSubscribe, todayKey, () => "");
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=auto`,
      { signal: ctrl.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => setWeather({ temp: Math.round(j.current.temperature_2m), code: j.current.weather_code }))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  let bsNp = "";
  let bsEn = "";
  if (key) {
    const [y, m, d] = key.split("-").map(Number);
    const bs = new NepaliDate(new Date(y, m, d));
    bsNp = bs.format("DD MMMM YYYY, ddd", "np");
    bsEn = bs.format("DD MMMM YYYY");
  }

  return (
    <div className="glass mt-5 flex items-center justify-between rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2.5">
        <CalendarDays size={20} className="text-brand" />
        <div className="leading-tight">
          <p className="text-sm font-medium">{bsNp || " "}</p>
          <p className="text-[11px] text-slate-400">{bsEn || " "} B.S.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 border-l border-slate-200/80 pl-4">
        <WeatherIcon code={weather ? weather.code : 3} />
        <div className="leading-tight text-right">
          <p className="text-sm font-medium">{weather ? `${weather.temp}°C` : "--"}</p>
          <p className="text-[11px] text-slate-400">{PLACE}</p>
        </div>
      </div>
    </div>
  );
}
