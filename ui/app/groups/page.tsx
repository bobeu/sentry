import { GroupsPanel } from "@/components/GroupsPanel";

export default function GroupsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="border-b border-primary/15 pb-5">
        <h1 className="text-3xl font-black text-text-dark">
          Telegram Groups
        </h1>
        <p className="mt-2 max-w-2xl text-xs text-muted font-semibold leading-relaxed">
          Hire Sentry globally, then enable each group. Employment status, activity, and FAQs
          live here.
        </p>
      </div>
      <GroupsPanel />
    </main>
  );
}

