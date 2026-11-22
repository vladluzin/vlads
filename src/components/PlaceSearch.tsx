"use client";
import { useEffect, useRef, useState } from "react";

export interface PlaceValue {
  placeLabel: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

interface Place { name: string; country: string | null; admin: string | null; latitude: number; longitude: number; timeZone: string }
const label = (p: Place) => [p.name, p.admin, p.country].filter(Boolean).join(", ");

export function PlaceSearch({ value, onChange, placeholder, lang }: { value: PlaceValue | null; onChange: (v: PlaceValue) => void; placeholder: string; lang: string }) {
  const [q, setQ] = useState(value?.placeLabel ?? "");
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!open || q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&lang=${lang}`);
      if (res.ok) setResults((await res.json()).places);
    }, 300);
  }, [q, open, lang]);

  return (
    <div className="places">
      <input value={q} placeholder={placeholder} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} autoComplete="off" />
      {open && results.length > 0 && (
        <ul>
          {results.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => { const l = label(p); setQ(l); setOpen(false); onChange({ placeLabel: l, latitude: p.latitude, longitude: p.longitude, timeZone: p.timeZone }); }}>
                {label(p)} <span className="muted small">· {p.timeZone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
