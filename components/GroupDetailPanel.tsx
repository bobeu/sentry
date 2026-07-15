"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Faq = { id: string; question: string; answer: string };
type Message = { id: string; fromUsername: string | null; text: string; createdAt: string };

export function GroupDetailPanel() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [name, setName] = useState("");
  const [stats, setStats] = useState({
    actionsToday: 0,
    mentionsHandled: 0,
    spamRemoved: 0,
    summaryStatus: "No summary yet",
    enabled: false,
  });
  const [settings, setSettings] = useState({
    welcomeMembers: true,
    replyToMentions: true,
    answerQuestions: true,
    spamModeration: true,
    mentionNotifications: true,
    dailySummaryHour: 9,
  });
  const [rules, setRules] = useState("");
  const [purpose, setPurpose] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
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
      summaryStatus: g.summaryStatus ?? "No summary yet",
      enabled: g.enabled ?? false,
    });
    setSettings({
      welcomeMembers: g.settings?.welcomeMembers ?? true,
      replyToMentions: g.settings?.replyToMentions ?? true,
      answerQuestions: g.settings?.answerQuestions ?? true,
      spamModeration: g.settings?.spamModeration ?? true,
      mentionNotifications: g.settings?.mentionNotifications ?? true,
      dailySummaryHour: g.settings?.dailySummaryHour ?? 9,
    });
    setRules(g.rules ?? "");
    setPurpose(g.purpose ?? "");
    setFaqs(g.faqs ?? []);
    setMessages(g.recentMessages ?? []);
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, [groupId]);

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

  return (
    <div className="mt-8 space-y-10">
      <div>
        <Link href="/groups" className="text-sm text-[#9aa89a] hover:text-white">
          ← Groups
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
          {name || "Group"}
        </h1>
        <p className="mt-3 text-sm text-[#9aa89a]">
          Employment {stats.enabled ? "Enabled" : "Disabled"} · Actions today{" "}
          {stats.actionsToday} · Mentions {stats.mentionsHandled} · Spam removed{" "}
          {stats.spamRemoved} · {stats.summaryStatus}
        </p>
      </div>

      <form onSubmit={saveSettings} className="max-w-xl space-y-4">
        <h2 className="text-lg text-[#e8f5d8]">Settings</h2>
        {(
          [
            ["welcomeMembers", "Welcome message"],
            ["replyToMentions", "Mention replies"],
            ["answerQuestions", "FAQ / questions"],
            ["spamModeration", "Spam moderation"],
            ["mentionNotifications", "Mention notifications"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm text-[#c7d6c4]">
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
        <label className="block text-sm text-[#9aa89a]">
          Daily summary hour (UTC 0–23)
          <input
            type="number"
            min={0}
            max={23}
            value={settings.dailySummaryHour}
            onChange={(e) =>
              setSettings((s) => ({ ...s, dailySummaryHour: Number(e.target.value) }))
            }
            className="mt-2 w-28 rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
        </label>
        <label className="block text-sm text-[#9aa89a]">
          Group purpose
          <input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
        </label>
        <label className="block text-sm text-[#9aa89a]">
          Group rules
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={4}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#35d07f] px-5 py-2.5 text-sm font-semibold text-[#061008]"
        >
          Save settings
        </button>
      </form>

      <section className="max-w-xl space-y-4">
        <h2 className="text-lg text-[#e8f5d8]">FAQs</h2>
        <ul className="space-y-3">
          {faqs.map((faq) => (
            <li key={faq.id} className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <p className="font-medium text-[#e8f5d8]">{faq.question}</p>
              <p className="mt-1 text-[#9aa89a]">{faq.answer}</p>
              <button
                type="button"
                onClick={() => removeFaq(faq.id)}
                className="mt-2 text-xs text-red-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addFaq} className="space-y-3">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Question"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer"
            rows={3}
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 outline-none focus:border-[#35d07f]"
          />
          <button type="submit" className="rounded-full border border-white/20 px-5 py-2.5 text-sm">
            Add FAQ
          </button>
        </form>
      </section>

      <section className="max-w-2xl space-y-3">
        <h2 className="text-lg text-[#e8f5d8]">Recent Messages (24h working memory)</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-[#9aa89a]">No messages captured yet.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p className="text-[#9aa89a]">{m.fromUsername ?? "member"}</p>
              <p className="text-[#e8f5d8]">{m.text}</p>
            </div>
          ))
        )}
      </section>

      {message ? <p className="text-sm text-[#35d07f]">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
