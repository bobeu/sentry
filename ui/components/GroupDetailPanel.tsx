"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";


type Faq = { id: string; question: string; answer: string };
type KnowledgeSource = {
  id: string;
  type: "url" | "file";
  title: string | null;
  url: string | null;
  fileName: string | null;
  byteSize: number;
  status: string;
  error: string | null;
  _count?: { chunks: number };
};
type Message = { id: string; fromUsername: string | null; text: string; createdAt: string };


function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-primary/10 bg-white hover:bg-slate-50 transition shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-bold text-text-dark leading-none">{label}</p>
        <p className="text-xs text-muted leading-normal font-medium">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
          checked ? "bg-primary" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function GroupDetailPanel() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [activeTab, setActiveTab] = useState<"overview" | "capabilities" | "rules" | "faqs" | "knowledge" | "memory">("overview");
  const [name, setName] = useState("");
  const [stats, setStats] = useState({
    actionsToday: 0,
    mentionsHandled: 0,
    spamRemoved: 0,
    todaySpend: 0,
    summaryStatus: "No summary yet",
    enabled: false,
    recentMentions: [] as { id: string; label: string; completedAt: string }[],
    moderationEvents: [] as { id: string; label: string; completedAt: string }[],
  });
  const [settings, setSettings] = useState({
    welcomeMembers: true,
    replyToMentions: true,
    answerQuestions: true,
    spamModeration: true,
    mentionNotifications: true,
    dailySummaryHour: 9,
    workReportIntervalHours: 24,
    shiftHandover: true,
    escalationLadder: true,
    livingPlaybook: true,
    intentSensing: true,
    proofOfWork: true,
    incidentMode: true,
    memberMemoryEnabled: false,
    announcementsEnabled: true,
    birthdaysEnabled: true,
    birthdayHourUtc: 9,
    roseRelayEnabled: false,
    roseBotUsername: "MissRose_bot",
    adminModeration: true,
    hireInTelegram: true,
    personaRole: "default",
    personaTone: "",
  });
  const [rules, setRules] = useState("");
  const [purpose, setPurpose] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [kbUrl, setKbUrl] = useState("");
  const [kbTitle, setKbTitle] = useState("");
  const [kbFile, setKbFile] = useState<File | null>(null);
  const [kbBusy, setKbBusy] = useState(false);
  const [announceText, setAnnounceText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load group");
      return;
    }
    const g = json.group;
    setName(g.name ?? g.telegramId);
    setStats({
      actionsToday: g.actionsToday ?? 0,
      mentionsHandled: g.mentionsHandled ?? 0,
      spamRemoved: g.spamRemoved ?? 0,
      todaySpend: g.todaySpend ?? 0,
      summaryStatus: g.summaryStatus ?? "No summary yet",
      enabled: g.enabled ?? false,
      recentMentions: g.recentMentions ?? [],
      moderationEvents: g.moderationEvents ?? [],
    });
    setSettings({
      welcomeMembers: g.settings?.welcomeMembers ?? true,
      replyToMentions: g.settings?.replyToMentions ?? true,
      answerQuestions: g.settings?.answerQuestions ?? true,
      spamModeration: g.settings?.spamModeration ?? true,
      mentionNotifications: g.settings?.mentionNotifications ?? true,
      dailySummaryHour: g.settings?.dailySummaryHour ?? 9,
      workReportIntervalHours: g.settings?.workReportIntervalHours ?? 24,
      shiftHandover: g.settings?.shiftHandover ?? true,
      escalationLadder: g.settings?.escalationLadder ?? true,
      livingPlaybook: g.settings?.livingPlaybook ?? true,
      intentSensing: g.settings?.intentSensing ?? true,
      proofOfWork: g.settings?.proofOfWork ?? true,
      incidentMode: g.settings?.incidentMode ?? true,
      memberMemoryEnabled: g.settings?.memberMemoryEnabled ?? false,
      announcementsEnabled: g.settings?.announcementsEnabled ?? true,
      birthdaysEnabled: g.settings?.birthdaysEnabled ?? true,
      birthdayHourUtc: g.settings?.birthdayHourUtc ?? 9,
      roseRelayEnabled: g.settings?.roseRelayEnabled ?? false,
      roseBotUsername: g.settings?.roseBotUsername ?? "MissRose_bot",
      adminModeration: g.settings?.adminModeration ?? true,
      hireInTelegram: g.settings?.hireInTelegram ?? true,
      personaRole: g.settings?.personaRole ?? "default",
      personaTone: g.settings?.personaTone ?? "",
    });
    setRules(g.rules ?? "");
    setPurpose(g.purpose ?? "");
    setFaqs(g.faqs ?? []);
    setKnowledgeSources(g.knowledgeSources ?? []);
    setMessages(g.recentMessages ?? []);
    setError(null);
  }, [groupId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const res = await fetch(`/api/groups/${groupId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, rules, purpose }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Save failed");
      return;
    }
    setMessage("Settings saved");
    await refresh();
  }

  async function addFaq(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/groups/faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, question, answer }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "FAQ failed");
      return;
    }
    setQuestion("");
    setAnswer("");
    await refresh();
  }

  async function removeFaq(faqId: string) {
    await fetch("/api/groups/faq", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, faqId }),
    });
    await refresh();
  }

  async function addKnowledgeUrl(event: FormEvent) {
    event.preventDefault();
    setKbBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          url: kbUrl,
          title: kbTitle || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add knowledge URL");
        return;
      }
      setKbUrl("");
      setKbTitle("");
      setMessage("Knowledge URL ingested");
      await refresh();
    } finally {
      setKbBusy(false);
    }
  }

  async function addKnowledgeFile(event: FormEvent) {
    event.preventDefault();
    if (!kbFile) {
      setError("Choose a file first");
      return;
    }
    if (kbFile.size > 512 * 1024) {
      setError("File must be 512KB or smaller");
      return;
    }
    setKbBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("groupId", groupId);
      form.set("file", kbFile);
      if (kbTitle) form.set("title", kbTitle);
      const res = await fetch("/api/groups/knowledge", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to upload knowledge file");
        return;
      }
      setKbFile(null);
      setKbTitle("");
      setMessage("Knowledge file ingested");
      await refresh();
    } finally {
      setKbBusy(false);
    }
  }

  async function refreshKnowledge(sourceId: string) {
    setKbBusy(true);
    try {
      const res = await fetch("/api/groups/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, sourceId, action: "refresh" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Refresh failed");
        return;
      }
      setMessage("Knowledge source refreshed");
      await refresh();
    } finally {
      setKbBusy(false);
    }
  }

  async function removeKnowledge(sourceId: string) {
    await fetch("/api/groups/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, sourceId }),
    });
    await refresh();
  }

  async function postAnnouncement(event: FormEvent) {
    event.preventDefault();
    if (!announceText.trim()) return;
    setError(null);
    const res = await fetch("/api/groups/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, text: announceText }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Announce failed");
      return;
    }
    setAnnounceText("");
    setMessage("Announcement posted to the group");
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "capabilities", label: "Capabilities" },
    { id: "rules", label: "Rules & Persona" },
    { id: "faqs", label: "FAQ Database" },
    { id: "knowledge", label: "Knowledge Base" },
    { id: "memory", label: "Memory (24h)" },
  ] as const;

  return (
    <div className="mt-8 space-y-8 animate-rise">
      {/* Title block */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-primary/15 pb-4">
        <div>
          <Link href="/groups" className="text-xs font-bold text-muted hover:text-primary uppercase tracking-wider transition">
            ← Back to Groups
          </Link>
          <h1 className="mt-3 font-sans text-3xl font-extrabold text-text-dark">
            {name || "Group Settings"}
          </h1>
          <p className="mt-1.5 text-xs text-muted font-semibold">
            Status: {stats.enabled ? <span className="text-[#00D283] font-bold">Active Monitoring</span> : <span className="text-muted font-semibold">Disabled</span>} · Summary: {stats.summaryStatus}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-primary/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-primary hover:bg-primary/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Quick Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-card p-5 border border-primary/10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Active Duty</p>
              <p className="mt-2 text-lg font-black text-text-dark">
                {stats.enabled ? "Online & Scanning" : "Offline"}
              </p>
            </div>
            <div className="surface-card p-5 border border-primary/10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Today&apos;s Actions</p>
              <p className="mt-2 text-lg font-black text-text-dark">{stats.actionsToday}</p>
            </div>
            <div className="surface-card p-5 border border-primary/10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Today&apos;s Spend</p>
              <p className="mt-2 text-lg font-black text-primary">{stats.todaySpend.toFixed(3)} USDm</p>
            </div>
            <div className="surface-card p-5 border border-primary/10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Last Summary Status</p>
              <p className="mt-2 text-xs font-bold text-text-dark truncate">{stats.summaryStatus}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Mentions */}
            <div className="surface-card p-6 space-y-4 border border-primary/10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/5 pb-2">
                Recent Mentions Activity
              </h2>
              <ul className="space-y-2">
                {stats.recentMentions.length === 0 ? (
                  <li className="text-xs text-muted font-medium py-2">No mentions logged today.</li>
                ) : (
                  stats.recentMentions.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-xl border border-primary/10 bg-bg-light/40 px-3.5 py-2.5 text-xs text-text-dark">
                      <span className="font-bold text-primary">{m.label}</span>
                      <span className="text-muted font-bold font-mono">{new Date(m.completedAt).toLocaleTimeString()}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Moderation */}
            <div className="surface-card p-6 space-y-4 border border-primary/10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-dark border-b border-primary/5 pb-2">
                Moderation Incidents
              </h2>
              <ul className="space-y-2">
                {stats.moderationEvents.length === 0 ? (
                  <li className="text-xs text-muted font-medium py-2">No moderation alerts logged today.</li>
                ) : (
                  stats.moderationEvents.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-xl border border-primary/10 bg-bg-light/40 px-3.5 py-2.5 text-xs text-text-dark">
                      <span className="font-bold text-alert">{m.label}</span>
                      <span className="text-muted font-bold font-mono">{new Date(m.completedAt).toLocaleTimeString()}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === "capabilities" && (
        <form onSubmit={saveSettings} className="space-y-6 max-w-2xl">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Core Functionality</h2>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Toggle
                checked={settings.welcomeMembers}
                onChange={(v) => setSettings((s) => ({ ...s, welcomeMembers: v }))}
                label="Welcome Messages"
                description="Greets new community members automatically."
              />
              <Toggle
                checked={settings.replyToMentions}
                onChange={(v) => setSettings((s) => ({ ...s, replyToMentions: v }))}
                label="Mention Replies"
                description="Always answers direct mentions and replies."
              />
              <Toggle
                checked={settings.answerQuestions}
                onChange={(v) => setSettings((s) => ({ ...s, answerQuestions: v }))}
                label="FAQ resolution"
                description="Proactively responds to questions using database rules."
              />
              <Toggle
                checked={settings.spamModeration}
                onChange={(v) => setSettings((s) => ({ ...s, spamModeration: v }))}
                label="Spam Moderation"
                description="Heuristically removes spam and warns bots."
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Advanced Controls</h2>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Toggle
                checked={settings.shiftHandover}
                onChange={(v) => setSettings((s) => ({ ...s, shiftHandover: v }))}
                label="Shift Handovers"
                description="Sends brief reports on handover events."
              />
              <Toggle
                checked={settings.escalationLadder}
                onChange={(v) => setSettings((s) => ({ ...s, escalationLadder: v }))}
                label="Escalation Reviews"
                description="Sends high-stakes reply drafts for DM approval."
              />
              <Toggle
                checked={settings.livingPlaybook}
                onChange={(v) => setSettings((s) => ({ ...s, livingPlaybook: v }))}
                label="Living Playbook"
                description="Uses rulebook configurations inside LLM prompts."
              />
              <Toggle
                checked={settings.intentSensing}
                onChange={(v) => setSettings((s) => ({ ...s, intentSensing: v }))}
                label="Conversion Sensing"
                description="Notifies you of buy/support intent heuristics."
              />
              <Toggle
                checked={settings.incidentMode}
                onChange={(v) => setSettings((s) => ({ ...s, incidentMode: v }))}
                label="Incident Mode"
                description="Applies security restrictions during crisis triggers."
              />
              <Toggle
                checked={settings.proofOfWork}
                onChange={(v) => setSettings((s) => ({ ...s, proofOfWork: v }))}
                label="Proof of Work"
                description="Generates detailed logs of completed weekly actions."
              />
              <Toggle
                checked={settings.announcementsEnabled}
                onChange={(v) => setSettings((s) => ({ ...s, announcementsEnabled: v }))}
                label="Announcements"
                description="Enables broadcast actions via dashboard console."
              />
              <Toggle
                checked={settings.birthdaysEnabled}
                onChange={(v) => setSettings((s) => ({ ...s, birthdaysEnabled: v }))}
                label="Birthday Celebrations"
                description="Congratulates members on their birthdays."
              />
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Moderation Relays</h2>
            <div className="p-4 rounded-2xl border border-primary/10 bg-white space-y-4 shadow-sm">
              <Toggle
                checked={settings.roseRelayEnabled}
                onChange={(v) => setSettings((s) => ({ ...s, roseRelayEnabled: v }))}
                label="Relay to Rose Bot"
                description="Delegates bans and mutes directly to MissRose_bot."
              />
              {settings.roseRelayEnabled && (
                <label className="block text-xs font-bold text-muted">
                  Rose Bot Username (without @)
                  <input
                    value={settings.roseBotUsername}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, roseBotUsername: e.target.value.replace(/^@/, "") }))
                    }
                    placeholder="MissRose_bot"
                    className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs font-normal"
                  />
                </label>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/95 transition cursor-pointer"
            >
              Save Capabilities
            </button>
          </div>
        </form>
      )}

      {activeTab === "rules" && (
        <div className="space-y-6 max-w-2xl">
          <form onSubmit={saveSettings} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Playbook Context</h2>
              <label className="block text-xs font-bold text-muted">
                Group Purpose
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Support channel for Celo prepaids"
                  className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-muted">
                Group Rules / Policies
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={5}
                  placeholder="1. Keep chats technical.&#10;2. No advertising links.&#10;3. Report scams immediately."
                  className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary leading-relaxed text-xs font-normal"
                />
              </label>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Agent Persona Settings</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-bold text-muted">
                  Org-Chart Role
                  <select
                    value={settings.personaRole}
                    onChange={(e) => setSettings((s) => ({ ...s, personaRole: e.target.value }))}
                    className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-semibold"
                  >
                    <option value="default">Default persona</option>
                    <option value="support">Technical Support Agent</option>
                    <option value="announcer">Channel Broadcaster</option>
                    <option value="vip">VIP Lounge Concierge</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-muted">
                  Persona Tone Override (optional)
                  <input
                    value={settings.personaTone}
                    onChange={(e) => setSettings((s) => ({ ...s, personaTone: e.target.value }))}
                    placeholder="calm, concise, technical"
                    className="mt-2 w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs font-normal"
                  />
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 border-t border-primary/10 pt-4">
              <label className="block text-xs font-bold text-muted">
                Daily Summary Window Hour (UTC 0-23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.dailySummaryHour}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, dailySummaryHour: Number(e.target.value) }))
                  }
                  className="mt-2 w-28 rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-muted">
                Employer work report every (hours)
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={settings.workReportIntervalHours}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      workReportIntervalHours: Number(e.target.value),
                    }))
                  }
                  className="mt-2 w-28 rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs font-normal"
                />
                <span className="mt-1 block font-normal text-[10px] text-muted">
                  Default 24. Sentry DMs you a work summary on this cadence.
                </span>
              </label>
              <label className="block text-xs font-bold text-muted">
                Birthday Congratulate Hour (UTC 0-23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.birthdayHourUtc}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, birthdayHourUtc: Number(e.target.value) }))
                  }
                  className="mt-2 w-28 rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary font-mono text-xs font-normal"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-primary/95 transition cursor-pointer"
              >
                Save Playbook Settings
              </button>
            </div>
          </form>

          {/* Visual section illustrating playbooks & roles */}
          <div className="grid gap-5 sm:grid-cols-2 border-t border-primary/10 pt-6">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm group">
              <div className="relative h-40 w-full overflow-hidden">
                <Image src="/sentry_learns_your_rules.png" alt="Living Playbook Instruction Rules" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90" />
              </div>
              <div className="px-5 pb-5 pt-2">
                <h3 className="text-sm font-black text-text-dark">Sentry Learns Your Rules</h3>
                <p className="mt-1 text-xs text-muted font-medium leading-relaxed">Dynamic playbook learning continuously ingests channel purpose, rules, and exceptions to ensure precise policy compliance.</p>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/10 bg-white shadow-sm group">
              <div className="relative h-40 w-full overflow-hidden">
                <Image src="/many_roles.png" alt="Dynamic Org Roles" fill className="object-cover object-top group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/90" />
              </div>
              <div className="px-5 pb-5 pt-2">
                <h3 className="text-sm font-black text-text-dark">Dynamic Org Roles</h3>
                <p className="mt-1 text-xs text-muted font-medium leading-relaxed">Assign roles from Technical Support agent to Channel Broadcaster depending on your group chat&apos;s structural needs.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "faqs" && (
        <div className="space-y-8 max-w-2xl">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Existing FAQ Database</h2>
            {faqs.length === 0 ? (
              <p className="text-sm text-muted py-2">No FAQ items defined. Write one below to get started.</p>
            ) : (
              <ul className="space-y-3">
                {faqs.map((faq) => (
                  <li key={faq.id} className="rounded-xl border border-primary/10 bg-white p-4 space-y-2 shadow-sm">
                    <p className="text-sm font-bold text-text-dark">Q: {faq.question}</p>
                    <p className="text-xs text-muted leading-relaxed">A: {faq.answer}</p>
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => removeFaq(faq.id)}
                        className="text-[10px] font-bold text-alert hover:underline uppercase cursor-pointer"
                      >
                        Remove FAQ
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={addFaq} className="space-y-4 border-t border-primary/10 pt-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-dark">Add FAQ Rules</h2>
            <label className="block text-xs text-muted">
              Trigger Question
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is the minimum deposit?"
                required
                className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary"
              />
            </label>
            <label className="block text-xs text-muted">
              Response Answer
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                placeholder="The minimum deposit is 1.0 USDm."
                required
                className="mt-2 w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary leading-relaxed"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-primary/95 transition cursor-pointer"
            >
              Add FAQ Pair
            </button>
          </form>
        </div>
      )}

      {activeTab === "knowledge" && (
        <div className="space-y-8 max-w-2xl">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Active Knowledge Assets</h2>
            {knowledgeSources.length === 0 ? (
              <p className="text-sm text-muted py-2">No documents or URLs ingested. Sentry will rely on prompt files and FAQs.</p>
            ) : (
              <ul className="space-y-3">
                {knowledgeSources.map((src) => (
                  <li key={src.id} className="rounded-xl border border-primary/10 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-primary/5 pb-2 mb-2">
                      <span className="font-bold text-text-dark text-sm">
                        {src.title || src.fileName || src.url || "Document Source"}
                      </span>
                      <span className="text-[10px] bg-secondary/15 text-secondary px-2 py-0.5 rounded font-bold uppercase font-mono">
                        {src.type}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted space-y-1">
                      <p>Status: <strong className="text-text-dark uppercase">{src.status}</strong></p>
                      {src._count?.chunks != null && <p>Database Chunks: {src._count.chunks}</p>}
                      {src.byteSize > 0 && <p>Size: {Math.round(src.byteSize / 1024)} KB</p>}
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate text-[11px] text-secondary hover:underline"
                      >
                        🔗 {src.url}
                      </a>
                    )}
                    {src.error && <p className="mt-2 text-xs text-alert">{src.error}</p>}
                    <div className="mt-3 flex gap-4">
                      {src.type === "url" && (
                        <button
                          type="button"
                          disabled={kbBusy}
                          onClick={() => refreshKnowledge(src.id)}
                          className="text-[10px] font-bold text-accent uppercase hover:underline disabled:opacity-40"
                        >
                          Refresh URL
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeKnowledge(src.id)}
                        className="text-[10px] font-bold text-alert uppercase hover:underline"
                      >
                        Remove Document
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2 border-t border-primary/10 pt-6">
            {/* Ingest URL */}
            <form onSubmit={addKnowledgeUrl} className="surface-card p-5 space-y-3 border border-primary/10 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-dark">Ingest Documentation URL</h3>
              <input
                value={kbTitle}
                onChange={(e) => setKbTitle(e.target.value)}
                placeholder="Optional display name"
                className="w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs"
              />
              <input
                value={kbUrl}
                onChange={(e) => setKbUrl(e.target.value)}
                placeholder="https://docs.celo.org"
                required
                className="w-full rounded-lg border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs"
              />
              <button
                type="submit"
                disabled={kbBusy}
                className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-white hover:bg-primary/95 transition disabled:opacity-40 cursor-pointer"
              >
                {kbBusy ? "Crawling..." : "Index URL"}
              </button>
            </form>

            {/* Ingest File */}
            <form onSubmit={addKnowledgeFile} className="surface-card p-5 space-y-3 border border-primary/10 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-dark">Upload Reference File</h3>
              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Accepted: .txt, .md, .csv, .json, .html (max 512KB).
              </p>
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.json,.html,.htm,text/plain,text/markdown,text/html,application/json"
                onChange={(e) => setKbFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/15 file:cursor-pointer"
              />
              <button
                type="submit"
                disabled={kbBusy || !kbFile}
                className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-white hover:bg-primary/95 transition disabled:opacity-40 cursor-pointer"
              >
                Upload & Ingest
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "memory" && (
        <div className="space-y-6 max-w-2xl">
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-dark">Sentry Active Working Memory</h2>
            <p className="text-xs text-muted leading-relaxed font-medium">
              Below is the rolling 24-hour log of active user conversation threads. These logs are used as immediate context when Sentry responds to mentions or questions in the group chat.
            </p>
          </div>

          {messages.length === 0 ? (
            <p className="rounded-xl border border-primary/10 bg-white p-6 text-center text-sm text-muted font-medium">
              No conversations captured in working memory yet. Let users tag the bot or send questions.
            </p>
          ) : (
            <div className="flex flex-col gap-3 bg-bg-light/60 p-5 rounded-2xl border border-primary/10 max-h-[450px] overflow-y-auto">
              {messages.map((m) => (
                <div key={m.id} className="flex flex-col max-w-[85%] self-start">
                  <span className="text-[10px] text-muted mb-0.5 px-1.5 font-bold font-mono">
                    @{m.fromUsername ?? "member"} · {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <div className="telegram-bubble-in text-text-dark p-3.5 text-xs font-medium leading-relaxed shadow-sm">
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Broadcast Announcement section (standalone) */}
      <section className="border-t border-primary/10 pt-8 max-w-2xl">
        <div className="space-y-1">
          <h2 className="text-sm font-bold uppercase tracking-widest text-text-dark">Broadcast Public Announcement</h2>
          <p className="text-xs text-muted font-medium">
            Posts text broadcasts immediately directly into the Telegram group. (Requires announcements enabled above).
          </p>
        </div>
        <form onSubmit={postAnnouncement} className="mt-4 space-y-3">
          <textarea
            value={announceText}
            onChange={(e) => setAnnounceText(e.target.value)}
            placeholder="Write announcement body..."
            rows={3}
            className="w-full rounded-xl border border-primary/15 bg-white px-3.5 py-2.5 text-text-dark outline-none focus:border-primary text-xs leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!settings.announcementsEnabled}
              className="rounded-full bg-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Post Announcement Now
            </button>
          </div>
        </form>
      </section>

      {/* Global alert indicators */}
      {message && (
        <div className="rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 text-sm text-slate-900 max-w-2xl font-bold">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-alert/25 bg-alert/10 px-4 py-3 text-sm text-alert max-w-2xl font-bold">
          {error}
        </div>
      )}
    </div>
  );
}
