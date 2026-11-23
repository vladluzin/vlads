import { redirect } from "next/navigation";
import { ChatApp } from "@/components/ChatApp";
import { Nav } from "@/components/Nav";
import { currentUser } from "@/lib/auth/session";
import { activePlan } from "@/lib/billing/plans";
import { primaryProfile } from "@/lib/profiles";

export default async function ChatPage() {
  const user = await currentUser();
  if (!user) redirect("/");
  if (!(await primaryProfile(user.id))) redirect("/onboarding");
  const free = activePlan(user).id === "free";
  return (
    <>
      <Nav locale={user.locale} active="chat" />
      <ChatApp locale={user.locale} isFree={free} initialRemaining={free ? user.freeMessagesLeft : null} />
    </>
  );
}
