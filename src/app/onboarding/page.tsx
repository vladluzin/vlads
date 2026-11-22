import { redirect } from "next/navigation";
import { Onboarding } from "@/components/Onboarding";
import { currentUser } from "@/lib/auth/session";
import { t } from "@/lib/i18n";
import { primaryProfile } from "@/lib/profiles";

export default async function OnboardingPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const d = t(user.locale);
  const p = await primaryProfile(user.id);
  const initial = p
    ? { name: p.name, birthDate: p.birthDate, birthTime: p.birthTime, gender: p.gender as never, place: { placeLabel: p.placeLabel, latitude: p.latitude, longitude: p.longitude, timeZone: p.timeZone } }
    : { name: user.name ?? "" };
  return (
    <main className="narrow" style={{ padding: "48px 16px" }}>
      <h1>{d.onboardingTitle}</h1>
      <p className="muted">{d.onboardingText}</p>
      <div className="card"><Onboarding locale={user.locale} initial={initial} /></div>
    </main>
  );
}
