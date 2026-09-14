"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WalletPanel } from "@/components/EmploymentWalletPanels";
import { RewardsPanel } from "@/components/RewardsPanel";

export type WalletsTab = "employment" | "reward";

function parseTab(raw: string | null): WalletsTab {
  if (raw === "reward" || raw === "rewards" || raw === "reward-account") return "reward";
  return "employment";
}

export function WalletsConsole({ initialTab }: { initialTab?: WalletsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<WalletsTab>(
    initialTab ?? parseTab(searchParams.get("tab")),
  );

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: WalletsTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "employment") params.delete("tab");
    else params.set("tab", "reward");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-primary/10 pb-3">
        <button
          type="button"
          onClick={() => selectTab("employment")}
          className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            tab === "employment"
              ? "bg-primary text-white shadow-sm"
              : "border border-primary/15 bg-white text-text-dark hover:border-primary hover:text-primary"
          }`}
        >
          Employment Wallet
        </button>
        <button
          type="button"
          onClick={() => selectTab("reward")}
          className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
            tab === "reward"
              ? "bg-primary text-white shadow-sm"
              : "border border-primary/15 bg-white text-text-dark hover:border-primary hover:text-primary"
          }`}
        >
          Reward Account
        </button>
      </div>

      {tab === "employment" ? <WalletPanel /> : <RewardsPanel embedded />}
    </div>
  );
}
