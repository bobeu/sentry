import { GroupsPanel } from "@/components/GroupsPanel";

export default function GroupsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Telegram Groups
      </h1>
      <p className="mt-3 max-w-2xl text-[#9aa89a]">
        Hire Sentry globally, then enable each group. Employment status, activity, and FAQs
        live here.
      </p>
      <GroupsPanel />
    </main>
  );
}
