"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";

interface PlanCard { id: string; title: string; priceCents: number; features: string[] }

export function PricingView({ locale, plans, current }: { locale: string; plans: PlanCard[]; current: string }) {
  const d = t(locale);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function checkout(plan: string) {
    setBusy(plan); setErr(null);
    const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }) });
    const data = await r.json();
    setBusy(null);
    if (r.ok) window.location.href = data.url;
    else setErr(data.message ?? data.error);
  }
  return (
    <>
      <div className="plans">
        {plans.map((p) => (
          <div key={p.id} className={`card stack ${p.id === current ? "current" : ""}`}>
            <h2>{p.title}</h2>
            <div className="price">${(p.priceCents / 100).toFixed(2)} <span className="muted small">{p.priceCents ? d.perMonth : ""}</span></div>
            <ul>{p.features.map((f) => (<li key={f}>{f}</li>))}</ul>
            {p.id === current ? <span className="muted">{d.currentPlan}</span> : p.priceCents > 0 && <button disabled={busy !== null} onClick={() => checkout(p.id)}>{busy === p.id ? "…" : d.upgrade}</button>}
          </div>
        ))}
      </div>
      {err && <p className="error">{err}</p>}
    </>
  );
}
