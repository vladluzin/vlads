import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";

export function Nav({ locale, active }: { locale: string; active?: "chat" | "chart" | "settings" | "pricing" }) {
  const d = t(locale);
  const items = [
    ["chat", "/chat", d.chat],
    ["chart", "/chart", d.chart],
    ["pricing", "/pricing", d.pricing],
    ["settings", "/settings", d.settings],
  ] as const;
  return (
    <nav className="nav">
      <Link href="/chat" className="brand">{BRAND.name}</Link>
      <div className="links">
        {items.map(([key, href, label]) => (
          <Link key={key} href={href} className={active === key ? "active" : undefined}>{label}</Link>
        ))}
      </div>
    </nav>
  );
}
