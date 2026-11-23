"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

export function Login({ locale }: { locale: string }) {
  const d = t(locale);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setBusy(false);
    if (res.ok) setStep("code");
    else setErr((await res.json()).message ?? "Error");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const res = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok) router.push(data.next);
    else setErr(data.error === "expired" ? "Code expired" : data.error === "too_many_attempts" ? "Too many attempts — request a new code" : "Wrong code");
  }

  return (
    <div className="card stack">
      {step === "email" ? (
        <form className="stack" onSubmit={requestCode}>
          <input type="email" required placeholder={d.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <button disabled={busy}>{d.getCode}</button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <p className="muted small">{d.codeSent} {email}</p>
          <input inputMode="numeric" pattern="\d{6}" maxLength={6} required placeholder={d.codePlaceholder} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" />
          <button disabled={busy}>{d.signIn}</button>
          <button type="button" className="ghost" onClick={() => setStep("email")}>{d.back}</button>
        </form>
      )}
      {err && <p className="error small">{err}</p>}
      <p className="muted small">{d.freeNote}</p>
    </div>
  );
}
