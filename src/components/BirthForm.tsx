"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { PlaceSearch, type PlaceValue } from "./PlaceSearch";

export interface BirthValues {
  name: string;
  birthDate: string;
  birthTime: string | null;
  gender: "male" | "female" | "other" | null;
  place: PlaceValue | null;
  relation?: string;
}

export function BirthForm({ locale, initial, withRelation, submitLabel, onSubmit }: {
  locale: string;
  initial?: Partial<BirthValues>;
  withRelation?: boolean;
  submitLabel?: string;
  onSubmit: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const d = t(locale);
  const [v, setV] = useState<BirthValues>({ name: "", birthDate: "", birthTime: "12:00", gender: null, place: null, relation: "partner", ...initial });
  const [unknownTime, setUnknownTime] = useState(initial?.birthTime === null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.place) { setErr(d.birthPlace + "?"); return; }
    setBusy(true); setErr(null);
    const error = await onSubmit({
      name: v.name,
      birthDate: v.birthDate,
      birthTime: unknownTime ? null : v.birthTime,
      gender: v.gender,
      ...v.place,
      ...(withRelation ? { relation: v.relation } : {}),
    });
    setBusy(false);
    if (error) setErr(error);
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>{d.name}<input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      {withRelation && (
        <label>{d.relation}
          <select value={v.relation} onChange={(e) => setV({ ...v, relation: e.target.value })}>
            <option value="partner">{d.partner}</option><option value="child">{d.child}</option><option value="parent">{d.parent}</option><option value="friend">{d.friend}</option>
          </select>
        </label>
      )}
      <div className="row">
        <label>{d.birthDate}<input type="date" required value={v.birthDate} onChange={(e) => setV({ ...v, birthDate: e.target.value })} /></label>
        <label>{d.birthTime}<input type="time" disabled={unknownTime} required={!unknownTime} value={v.birthTime ?? ""} onChange={(e) => setV({ ...v, birthTime: e.target.value })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={unknownTime} onChange={(e) => setUnknownTime(e.target.checked)} />{d.timeUnknown}</label>
      <label>{d.birthPlace}<PlaceSearch value={v.place} lang={locale} placeholder={d.searchCity} onChange={(place) => setV({ ...v, place })} /></label>
      <label>{d.gender}
        <select value={v.gender ?? ""} onChange={(e) => setV({ ...v, gender: (e.target.value || null) as BirthValues["gender"] })}>
          <option value="">—</option><option value="male">{d.male}</option><option value="female">{d.female}</option><option value="other">{d.other}</option>
        </select>
      </label>
      {err && <p className="error">{err}</p>}
      <button disabled={busy}>{busy ? d.saving : submitLabel ?? d.save}</button>
    </form>
  );
}
