import { redirect } from "next/navigation";
import { ChartView } from "@/components/ChartView";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles";

export default async function ChartPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  const profiles = await listProfiles(user.id);
  if (!profiles.length) redirect("/onboarding");
  const people = [...profiles].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((p) => ({ id: p.id, name: p.name }));
  return (
    <>
      <Nav locale={user.locale} active="chart" />
      <main className="container"><ChartView locale={user.locale} people={people} /></main>
    </>
  );
}
