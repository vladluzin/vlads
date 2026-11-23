"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { BirthForm } from "./BirthForm";

interface Prefs { dailyForecast: boolean; weeklyForecast: boolean; dashaAlerts: boolean; transitAlerts: boolean; deliveryHour: number; channel: "telegram" | "email" }
interface Person { id: string; name: string; relation: string; birthDate: string; isPrimary: boolean }

export function SettingsView({ locale, telegramConnected, botUsername }: { locale: string; telegramConnected: boolean; botUsername: string | null }) {
  const d = t(locale);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadPeople = () => fetch("/api/profiles").then(async (r) => r.ok && setPeople((await r.json()).profiles));
  useEffect(() => {
    fetch("/api/notifications").then(async (r) => r.ok && setPrefs((await r.json()).prefs ?? { dailyForecast: true, weeklyForecast: true, dashaAlerts: true, transitAlerts: true, deliveryHour: 8, channel: "telegram" }));
    loadPeople();
  }, []);

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    const r = await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    setSaved(r.ok);
    setTimeout(() => setSaved(false), 1500);
  }

  async function connectTelegram() {
    const r = await fetch("/api/telegram/link", { method: "POST" });
    if (r.ok) window.open((await r.json()).url, "_blank");
  }

  async function setLocale(l: string) {
    await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale: l }) });
    window.location.reload();
  }

  return (
    <div className="stack" style={{ padding: "24px 0 48px" }}>
      <div className="card stack">
        <h2>{d.notifications}</h2>
        {prefs && (
          <>
            {(["dailyForecast", "weeklyForecast", "dashaAlerts", "transitAlerts"] as const).map((k) => (
              <label key={k} className="check"><input type="checkbox" checked={prefs[k]} onChange={(e) => savePrefs({ ...prefs, [k]: e.target.checked })} />{d[k]}</label>
            ))}
            <div className="row">
              <label>{d.deliveryHour}
                <select value={prefs.deliveryHour} onChange={(e) => savePrefs({ ...prefs, deliveryHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (<option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>))}
                </select>
              </label>
              <label>{d.channel}
                <select value={prefs.channel} onChange={(e) => savePrefs({ ...prefs, channel: e.target.value as Prefs["channel"] })}>
                  <option value="telegram">{d.telegram}</option><option value="email">{d.email}</option>
                </select>
              </label>
            </div>
            {saved && <span className="ok small">✓</span>}
          </>
        )}
        <div>
          {telegramConnected ? <span className="ok">✓ {d.telegramConnected}</span> : botUsername ? <button className="secondary" onClick={connectTelegram}>{d.connectTelegram}</button> : null}
        </div>
      </div>

      <div className="card stack">
        <h2>{d.people}</h2>
        {people.filter((p) => !p.isPrimary).map((p) => (
          <div key={p.id} className="row" style={{ alignItems: "center" }}>
            <span>{p.name} <span className="muted small">· {p.relation} · {p.birthDate}</span></span>
            <button className="danger" style={{ flex: "0 0 auto" }} onClick={async () => { await fetch(`/api/profiles/${p.id}`, { method: "DELETE" }); loadPeople(); }}>{d.remove}</button>
          </div>
        ))}
        {adding ? (
          <BirthForm
            locale={locale}
            withRelation
            submitLabel={d.addPerson}
            onSubmit={async (body) => {
              const r = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
              if (!r.ok) return (await r.json()).message ?? "Error";
              setAdding(false);
              loadPeople();
              return null;
            }}
          />
        ) : (
          <button className="secondary" onClick={() => setAdding(true)}>+ {d.addPerson}</button>
        )}
      </div>

      <div className="card stack">
        <div className="row" style={{ alignItems: "center" }}>
          <Link href="/onboarding">{d.editBirth}</Link>
          <select value={locale} onChange={(e) => setLocale(e.target.value)} style={{ maxWidth: 160 }}>
            <option value="en">English</option><option value="ru">Русский</option>
          </select>
          <button className="secondary" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>{d.logout}</button>
        </div>
      </div>
    </div>
  );
}
