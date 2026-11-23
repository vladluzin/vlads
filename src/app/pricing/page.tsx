import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { PricingView } from "@/components/PricingView";
import { currentUser } from "@/lib/auth/session";
import { FREE_MESSAGES, PLANS, activePlan } from "@/lib/billing/plans";

export default async function PricingPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const ru = user.locale === "ru";
  const features = (id: keyof typeof PLANS) => {
    const p = PLANS[id];
    const L: string[] = [];
    L.push(id === "free" ? (ru ? `${FREE_MESSAGES} сообщений астрологу` : `${FREE_MESSAGES} messages with the astrologer`) : ru ? `До ${p.dailyMessages} сообщений в день` : `Up to ${p.dailyMessages} messages a day`);
    L.push(ru ? "Полная карта, 13 дробных карт, даши" : "Full chart, 13 divisional charts, dashas");
    L.push(p.dailyForecast ? (ru ? "Ежедневный и недельный прогноз" : "Daily and weekly forecasts") : ru ? "Недельный прогноз" : "Weekly forecast");
    L.push(ru ? "Уведомления о дашах и транзитах" : "Dasha and transit alerts");
    L.push(ru ? `Карт других людей: ${p.savedPeople}` : `Saved charts of others: ${p.savedPeople}`);
    L.push(ru ? "Чат в Telegram" : "Chat in Telegram");
    return L;
  };
  return (
    <>
      <Nav locale={user.locale} active="pricing" />
      <main className="container">
        <PricingView
          locale={user.locale}
          current={activePlan(user).id}
          plans={(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => ({ id, title: PLANS[id].title, priceCents: PLANS[id].priceCents, features: features(id) }))}
        />
      </main>
    </>
  );
}
