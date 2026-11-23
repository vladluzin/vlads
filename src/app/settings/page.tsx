import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { SettingsView } from "@/components/SettingsView";
import { currentUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  return (
    <>
      <Nav locale={user.locale} active="settings" />
      <main className="narrow" style={{ maxWidth: 720 }}>
        <SettingsView locale={user.locale} telegramConnected={user.telegramId !== null} botUsername={process.env.TELEGRAM_BOT_USERNAME ?? null} />
      </main>
    </>
  );
}
