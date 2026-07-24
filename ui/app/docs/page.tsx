import Link from "next/link";

const botHandle = "@tgemployee_bot";
const appUrl = "https://sentry-sigma-two.vercel.app";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 space-y-6">
      <div className="border-b border-primary/15 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Technical Guide</p>
        <h1 className="mt-3 text-4xl font-black text-text-dark">
          Documentation
        </h1>
        <p className="mt-1.5 text-xs text-muted font-semibold leading-relaxed">
          Integrate Sentry as an intelligent AI Telegram employee. Prepaid billing, engagement rewards, group policies, and agent telemetry.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 pt-4">
        {/* Sticky Sidebar Table of Contents */}
        <aside className="lg:col-span-3 lg:sticky lg:top-24 h-fit space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted px-2">On this page</p>
          <nav className="surface-card p-3.5 text-xs font-bold text-muted flex flex-col gap-0.5 shadow border border-primary/10">
            {[
              ["#what", "What is Sentry"],
              ["#quickstart", "Quick start"],
              ["#connect", "Connect Telegram"],
              ["#funding", "Funding & billing"],
              ["#groups", "Groups & settings"],
              ["#community", "Community features"],
              ["#agent", "Advanced agent capacity"],
              ["#reports", "Reports & dashboard"],
              ["#agent-api", "Agent-to-agent API"],
              ["#commands", "Commands & tips"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block py-2 px-3 rounded-lg hover:text-primary hover:bg-primary/5 transition"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Documentation Content */}
        <div className="lg:col-span-9 space-y-12 text-sm leading-relaxed text-text-dark/80">
          <section id="what" className="space-y-3 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              What is Sentry?
            </h2>
            <p>
              Sentry is a hireable AI Telegram employee (as{" "}
              <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">{botHandle}</code>
              ). It is not a shallow command bot: it reads context, answers FAQs, moderates,
              welcomes members, hosts polls/trivia/games with points (and optional cash rewards),
              escalates risky replies for your approval, and reports what it did. Replies are
              formatted to stand out in chat. Work is billed from a prepaid on-chain employment
              wallet on <strong className="text-text-dark font-bold">Celo</strong>. When available
              balance hits zero, billable agent work pauses until you deposit again (strong FAQ
              matches can still answer when configured).
            </p>
          </section>

          <section id="quickstart" className="space-y-3 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Quick start
            </h2>
            <ol className="list-decimal space-y-2.5 pl-5 text-muted">
              <li>
                Open{" "}
                <Link href="/login" className="text-primary font-bold hover:underline">
                  Sign in
                </Link>{" "}
                with your Celo wallet and email (creates an account on first use).
              </li>
              <li>
                Go to{" "}
                <Link href="/employment" className="text-primary font-bold hover:underline">
                  Employment
                </Link>{" "}
                → <strong className="text-text-dark font-bold">Hire Sentry</strong> (provisions your
                employment wallet).
              </li>
              <li>
                Fund the wallet on{" "}
                <Link href="/wallet" className="text-primary font-bold hover:underline">
                  Wallets
                </Link>{" "}
                (connect MetaMask / MiniPay or send funds to the address).
              </li>
              <li>
                Add {botHandle} to your Telegram group and <strong className="text-text-dark font-bold">promote it to admin</strong>{" "}
                so it can see all messages (or disable bot privacy in BotFather).
              </li>
              <li>
                On{" "}
                <Link href="/groups" className="text-primary font-bold hover:underline">
                  Groups
                </Link>
                , enter the group chat ID (usually starts with <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">-100</code>) and{" "}
                <strong className="text-text-dark font-bold">Enable</strong>.
              </li>
              <li>
                Link your Telegram user ID under{" "}
                <Link href="/settings" className="text-primary font-bold hover:underline">
                  Settings
                </Link>{" "}
                for private DMs, escalations, and reports.
              </li>
            </ol>
          </section>

          <section id="connect" className="space-y-4 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Connect Telegram
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-black text-text-dark">1. Add Sentry Bot</h3>
                <p className="mt-1">
                  Invite {botHandle} to the group. When it joins as a normal member, Telegram
                  privacy mode may hide non-mention messages. Promote Sentry to{" "}
                  <strong className="text-text-dark font-bold">group admin</strong> (delete messages
                  optional, needed for strong spam removal).
                </p>
              </div>
              <div>
                <h3 className="text-base font-black text-text-dark">2. Find the chat ID</h3>
                <p className="mt-1">
                  Supergroups use IDs like <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">-1001285489868</code>.
                  Paste that into Groups → Enable. If the bot is already in the chat, Sentry
                  can import the group even if the webhook missed the join event.
                </p>
              </div>
              <div>
                <h3 className="text-base font-black text-text-dark">3. Link yourself for DMs</h3>
                <p className="mt-1">
                  In Telegram, open a chat with {botHandle} and note your numeric user ID
                  (or use a user-ID bot). Save it in Settings → Telegram user ID. Without
                  this, hire/fund still works, but private reports, escalations, and DM
                  assistance cannot reach you.
                </p>
              </div>
              <div>
                <h3 className="text-base font-black text-text-dark">4. Mention &amp; DM</h3>
                <p className="mt-1">
                  In groups: tag {botHandle} or reply to its messages. In DM: ask questions,
                  request <em>group status</em>, <em>past work</em>, or <em>full report</em>.
                </p>
              </div>
            </div>
          </section>

          <section id="funding" className="space-y-3 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Funding &amp; billing
            </h2>
            <p>
              There is no subscription. You deposit into an employment wallet; each
              completed action records a small charge. Settlements batch outstanding
              charges on-chain when thresholds are met.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-text-dark font-bold">Deposit from wallet:</strong> connect
                MetaMask or MiniPay on the Wallets page, enter an amount, Deposit. Celo
                transactions include Sentry&apos;s attribution tag for hackathon volume
                tracking.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Send directly:</strong> transfer the
                accepted currency to the displayed address, then Sync Balance.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Available balance:</strong> on-chain
                balance minus outstanding charges. Billable agent work needs available
                balance &gt; 0.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Withdraw:</strong> set and confirm a
                destination address, then withdraw up to the withdrawable amount.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Pause / resume:</strong> Employment
                page can pause work without destroying the wallet.
              </li>
            </ul>
            <p className="pt-1">
              See{" "}
              <Link href="/pricing" className="text-primary font-bold hover:underline">
                Pricing
              </Link>{" "}
              for per-action amounts (FAQ answer, mention reply, summary, escalation,
              agent task, etc.).
            </p>
          </section>

          <section id="groups" className="space-y-3 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Groups &amp; configuration
            </h2>
            <p>
              Open a group detail page to edit purpose, rules, FAQs, and feature toggles.
              Core toggles:
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-muted">
              <li>Welcome message &middot; Mention replies &middot; FAQ / questions</li>
              <li>Spam moderation &middot; Mention notifications</li>
              <li>Daily summary hour (UTC) and delivery channels</li>
              <li>
                Advanced: shift handover, escalation ladder, living playbook, intent
                sensing, proof-of-work, incident mode, member memory, hire-in-Telegram
              </li>
              <li>
                Engagement (Capabilities tab): polls, games/trivia, fun, comics, social
                campaigns, humor style, points &amp; optional cash rewards via RewardAccount
              </li>
              <li>
                Persona role (<code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">support</code> /{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">announcer</code> /{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">vip</code>) and optional tone — applied
                only when not left on default
              </li>
            </ul>
            <p className="pt-1">
              Add FAQs as short Q&rarr;A pairs. Strong lexical matches answer instantly;
              paraphrases fall through to the AI agent with FAQ context.
            </p>
          </section>

          <section id="community" className="space-y-4 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Community features
            </h2>
            <dl className="space-y-5">
              <div>
                <dt className="text-base font-black text-text-dark">Mentions &amp; Q&amp;A</dt>
                <dd className="mt-1">
                  When mentioned or replied to, Sentry always responds (capabilities,
                  enable/fund prompts, or a full answer). With Q&amp;A enabled and the bot
                  able to see messages, it can answer questions proactively using FAQs and
                  recent chat context.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Welcomes</dt>
                <dd className="mt-1">
                  Greets new members with a short agent welcome grounded in group purpose and
                  rules (when funded and welcome is on).
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Spam moderation</dt>
                <dd className="mt-1">
                  Heuristic spam inspection: warn, notify admins, or delete when the bot has
                  permission and confidence is high.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Mention notifications</dt>
                <dd className="mt-1">
                  When someone mentions your Telegram username in an enabled group, Sentry
                  can DM you a short digest (requires linked Telegram user ID).
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Personal DM assistant</dt>
                <dd className="mt-1">
                  Linked employers can chat with Sentry in private: draft replies, explain
                  threads, ask for status/work reports. FAQs short-circuit only on strong
                  matches; everything else uses the agent with operational context.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Engagement &amp; games</dt>
                <dd className="mt-1">
                  When enabled, Sentry can start polls, quizzes, learn-and-earn, fun/comics, and
                  Twitter/X campaigns. Quizzes use inline buttons with instant judging (or
                  members can reply/tag with an answer). Members earn points; employers can
                  fund a separate RewardAccount for cash payouts.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Member status hub</dt>
                <dd className="mt-1">
                  In any group where Sentry works, members run{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/mystatus</code>{" "}
                  or{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/points</code>{" "}
                  for interactive buttons: points, pending cash, recent games, leaderboard,
                  active rounds, and withdraw help.
                </dd>
              </div>
            </dl>
          </section>

          <section id="agent" className="space-y-4 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Advanced agent capacity
            </h2>
            <dl className="space-y-5">
              <div>
                <dt className="text-base font-black text-text-dark">Shift handover</dt>
                <dd className="mt-1">
                  Alongside the daily summary window, Sentry DMs a brief: what it handled,
                  unanswered questions, and what needs a human. Toggle per group.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Escalation ladder</dt>
                <dd className="mt-1">
                  High-stakes or ambiguous replies (legal, refunds, hacks, etc.) are drafted
                  and sent to you with Approve / Ignore buttons. Reply{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">edit: your text</code> in DM to post a
                  revised version. The group sees a short &ldquo;awaiting employer approval&rdquo;
                  note until you act.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Living playbook</dt>
                <dd className="mt-1">
                  Teach Sentry your policies. In DM send{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">correct: trigger &rarr; instruction</code>{" "}
                  (or manage rules via API). Active rules are injected into the agent
                  prompt for that employer/group.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Intent / conversion sensing</dt>
                <dd className="mt-1">
                  Detects buy, support, or scam-like intent in chats and notifies you. It
                  does not spam links; answers still go through FAQ/agent paths.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Incident mode</dt>
                <dd className="mt-1">
                  Crisis keywords (hack, rug, outage, …) trigger a public notice and
                  admin alerts. Deduped for a short window so the group is not flooded.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Member memory</dt>
                <dd className="mt-1">
                  Off by default. When enabled, members can{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/remember …</code> (consent) and{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/forget</code>. Notes may inform later
                  replies for that member in that group only.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Org-chart personas</dt>
                <dd className="mt-1">
                  One hire, many groups: set support vs announcer vs VIP tone per group so
                  Sentry does not sound identical everywhere.
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Hire-in-Telegram</dt>
                <dd className="mt-1">
                  When tagged in a group that is not fully enabled, Sentry demos presence
                  and shares a deep link to{" "}
                  <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">
                    {appUrl}/employment?hire=1
                  </code>
                  .
                </dd>
              </div>
              <div>
                <dt className="text-base font-black text-text-dark">Proof of work</dt>
                <dd className="mt-1">
                  Weekly rollup of actions and spend (also on the Dashboard). Makes prepaid
                  fees tangible: what Sentry did for the money.
                </dd>
              </div>
            </dl>
          </section>

          <section id="reports" className="space-y-3 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Reports &amp; dashboard
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-muted">
              <li>
                <strong className="text-text-dark font-bold">Dashboard:</strong> employment status,
                balances, spend, recent actions, pending escalations, incidents, handovers,
                and proof-of-work snapshot.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Daily summary:</strong> agent bullet summary
                at the configured UTC hour (group / admins / private — per settings).
              </li>
              <li>
                <strong className="text-text-dark font-bold">DM reports:</strong> ask Sentry for{" "}
                <em>group status</em>, <em>past work</em>, or <em>full report</em> for a
                structured operational brief.
              </li>
              <li>
                <strong className="text-text-dark font-bold">Group detail:</strong> today&apos;s actions,
                spend, recent mentions, moderation events, and FAQ editor.
              </li>
            </ul>
          </section>

          <section id="agent-api" className="space-y-4 border-b border-primary/10 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Agent-to-agent API
            </h2>
            <p>
              Other agents or backends can call Sentry over HTTP. Creating a key in
              Settings enables the API for your account. Each successful task bills an{" "}
              <strong className="text-text-dark font-bold">agent_task</strong> charge and requires
              Active employment + available balance.
            </p>
            <h3 className="text-base font-black text-text-dark">Setup</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Settings &rarr; Agent task API &rarr; Create key (copy the secret once).</li>
              <li>
                Call{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">POST {appUrl}/api/agent/v1/tasks</code>
              </li>
              <li>
                Header:{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">Authorization: Bearer sk_sentry_…</code>
              </li>
            </ol>
            <h3 className="mt-4 text-base font-black text-text-dark">Tasks Supported</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">status</code> &mdash; employment, enabled
                groups, available balance.
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">summarize_thread</code> &mdash; body{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">{`{ "task": "summarize_thread", "groupId": "…" }`}</code>
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">answer_faq</code> &mdash; body{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">{`{ "task": "answer_faq", "groupId": "…", "question": "…" }`}</code>{" "}
                (FAQ match or agent reply).
              </li>
            </ul>
          </section>

          <section id="commands" className="space-y-3 pb-8">
            <h2 className="text-2xl font-black text-text-dark">
              Commands &amp; tips
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/start</code> <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/help</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/status</code> &mdash; identity and employment
                snapshot (DM)
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/mystatus</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/points</code> &mdash; interactive points,
                games &amp; rewards menu (group)
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/poll</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/trivia</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/campaign</code> &mdash; start engagement
                activities when enabled
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/mywallet</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/balance</code>{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/deposit</code> &mdash; wallet info in DM
              </li>
              <li>
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/remember</code> /{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">/forget</code> &mdash; member memory (when
                enabled)
              </li>
              <li>
                DM: <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">correct: …</code> for playbook;{" "}
                <code className="text-primary font-bold font-mono bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15">edit: …</code> for escalation edits
              </li>
              <li>
                Uses OpenAI when configured, with Google Gemini fallback.
              </li>
              <li>
                If the group is silent: confirm the bot is admin (or privacy off), the group
                is Enabled, and the wallet has available balance for deeper replies.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
