import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Login } from "@/components/Login";
import { currentUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { detectLocale, t } from "@/lib/i18n";

export default async function Home() {
  if (await currentUser()) redirect("/chat");
  const locale = detectLocale((await headers()).get("accept-language"));
  const d = t(locale);
  const features = locale === "ru"
    ? [["Точный расчёт", "Сидерический зодиак, айянамша Лахири, исторические часовые пояса, 13 дробных карт, Вимшоттари до пратьянтар."], ["Помнит вас", "Астролог запоминает важное из разговоров и связывает карту с вашей реальной ситуацией."], ["Прогнозы сами приходят", "Ежедневные и недельные прогнозы, уведомления о смене даш и крупных транзитах — в Telegram или на почту."], ["Совместимость", "Ашта-кута, Мангал-доша, навамша и 7-й дом — для партнёров, детей и близких."]]
    : [["Precise calculations", "Sidereal zodiac, Lahiri ayanamsa, historical time zones, 13 divisional charts, Vimshottari down to pratyantardasha."], ["Remembers you", "Your astrologer keeps track of what matters to you and connects your chart to your real situation."], ["Forecasts come to you", "Daily and weekly forecasts plus alerts for dasha changes and major transits, in Telegram or by email."], ["Compatibility", "Ashtakoota, Mangal dosha, navamsha and the 7th house for partners, children and family."]];
  return (
    <>
      <nav className="nav"><span className="brand">{BRAND.name}</span></nav>
      <main className="container">
        <section className="hero">
          <div>
            <h1>{d.tagline}</h1>
            <p className="lead">{d.heroText}</p>
          </div>
          <Login locale={locale} />
        </section>
        <section className="features">
          {features.map(([title, text]) => (
            <div className="card" key={title}><h3>{title}</h3><p className="muted">{text}</p></div>
          ))}
        </section>
      </main>
    </>
  );
}
