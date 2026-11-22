"use client";
import { useRouter } from "next/navigation";
import { BirthForm } from "./BirthForm";

export function Onboarding({ locale, initial }: { locale: string; initial?: Record<string, unknown> }) {
  const router = useRouter();
  return (
    <BirthForm
      locale={locale}
      initial={initial}
      onSubmit={async (body) => {
        const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) return (await res.json()).message ?? "Error";
        router.push("/chat");
        router.refresh();
        return null;
      }}
    />
  );
}
