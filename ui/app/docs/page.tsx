import Link from "next/link";

const botHandle = "@tgemployee_bot";
const appUrl = "https://sentry-sigma-two.vercel.app";

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <p className="text-sm uppercase tracking-[0.18em] text-[#9aa89a]">Guide</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Documentation
      </h1>
      <p className="mt-4 text-[#9aa89a]">
        Hire Sentry as an AI community employee on Telegram. Fund a prepaid Celo wallet,
        enable your groups, and pay only for completed work.
      </p>

      <nav className="mt-8 surface-card p-5 text-sm text-[#b7c4b5]">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9aa89a]">On this page</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
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
            <li key={href}>
              <a href={href} className="text-[var(--accent)] hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-12 space-y-12 text-[#c7d6c4]">
        <section id="what">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            What is Sentry?
          </h2>
          <p className="mt-3 text-[#9aa89a]">
            Sentry is a hireable AI agent that lives in Telegram (as {botHandle}). It is
            not a shallow command bot: it reads context, answers FAQs, moderates, welcomes
            members, escalates risky replies for your approval, and reports what it did.
            Work is billed from a prepaid on-chain employment wallet on{" "}
            <strong className="text-[#e8f5d8]">Celo</strong>. When available balance hits
            zero, billable agent work pauses until you deposit again (strong FAQ matches
            can still answer when configured).
          </p>
        </section>

        <section id="quickstart">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Quick start
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[#9aa89a]">
            <li>
              Open{" "}
              <Link href="/login" className="text-[var(--accent)] hover:underline">
                Sign in
              </Link>{" "}
              and enter your email (creates an account on first use).
            </li>
            <li>
              Go to{" "}
              <Link href="/employment" className="text-[var(--accent)] hover:underline">
                Employment
              </Link>{" "}
              → <strong className="text-[#e8f5d8]">Hire Sentry</strong> (provisions your
              employment wallet).
            </li>
            <li>
              Fund the wallet on{" "}
              <Link href="/wallet" className="text-[var(--accent)] hover:underline">
                Wallet
              </Link>{" "}
              (connect MetaMask / MiniPay or send funds to the address).
            </li>
            <li>
              Add {botHandle} to your Telegram group and <strong className="text-[#e8f5d8]">promote it to admin</strong>{" "}
              so it can see all messages (or disable bot privacy in BotFather).
            </li>
            <li>
              On{" "}
              <Link href="/groups" className="text-[var(--accent)] hover:underline">
                Groups
              </Link>
              , enter the group chat ID (usually starts with <code className="text-[#8cf1b7]">-100</code>) and{" "}
              <strong className="text-[#e8f5d8]">Enable</strong>.
            </li>
            <li>
              Link your Telegram user ID under{" "}
              <Link href="/settings" className="text-[var(--accent)] hover:underline">
                Settings
              </Link>{" "}
              for private DMs, escalations, and reports.
            </li>
          </ol>
        </section>

        <section id="connect">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Connect Telegram
          </h2>
          <div className="mt-3 space-y-4 text-[#9aa89a]">
            <div>
              <h3 className="text-lg text-[#e8f5d8]">1. Add the bot</h3>
              <p className="mt-1">
                Invite {botHandle} to the group. When it joins as a normal member, Telegram
                privacy mode may hide non-mention messages. Promote Sentry to{" "}
                <strong className="text-[#e8f5d8]">group admin</strong> (delete messages
                optional, needed for strong spam removal).
              </p>
            </div>
            <div>
              <h3 className="text-lg text-[#e8f5d8]">2. Find the chat ID</h3>
              <p className="mt-1">
                Supergroups use IDs like <code className="text-[#8cf1b7]">-1001285489868</code>.
                Paste that into Groups → Enable. If the bot is already in the chat, Sentry
                can import the group even if the webhook missed the join event.
              </p>
            </div>
            <div>
              <h3 className="text-lg text-[#e8f5d8]">3. Link yourself for DMs</h3>
              <p className="mt-1">
                In Telegram, open a chat with {botHandle} and note your numeric user ID
                (or use a user-ID bot). Save it in Settings → Telegram user ID. Without
                this, hire/fund still works, but private reports, escalations, and DM
                assistance cannot reach you.
              </p>
            </div>
            <div>
              <h3 className="text-lg text-[#e8f5d8]">4. Mention &amp; DM</h3>
              <p className="mt-1">
                In groups: tag {botHandle} or reply to its messages. In DM: ask questions,
                request <em>group status</em>, <em>past work</em>, or <em>full report</em>.
              </p>
            </div>
          </div>
        </section>

        <section id="funding">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Funding &amp; billing
          </h2>
          <div className="mt-3 space-y-3 text-[#9aa89a]">
            <p>
              There is no subscription. You deposit into an employment wallet; each
              completed action records a small charge. Settlements batch outstanding
              charges on-chain when thresholds are met.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-[#e8f5d8]">Deposit from wallet:</strong> connect
                MetaMask or MiniPay on the Wallet page, enter an amount, Deposit. Celo
                transactions include Sentry’s attribution tag for hackathon volume
                tracking.
              </li>
              <li>
                <strong className="text-[#e8f5d8]">Send directly:</strong> transfer the
                accepted currency to the displayed address, then Sync Balance.
              </li>
              <li>
                <strong className="text-[#e8f5d8]">Available balance:</strong> on-chain
                balance minus outstanding charges. Billable AI work needs available
                balance &gt; 0.
              </li>
              <li>
                <strong className="text-[#e8f5d8]">Withdraw:</strong> set and confirm a
                destination address, then withdraw up to the withdrawable amount.
              </li>
              <li>
                <strong className="text-[#e8f5d8]">Pause / resume:</strong> Employment
                page can pause work without destroying the wallet.
              </li>
            </ul>
            <p>
              See{" "}
              <Link href="/pricing" className="text-[var(--accent)] hover:underline">
                Pricing
              </Link>{" "}
              for per-action amounts (FAQ answer, mention reply, summary, escalation,
              agent task, etc.).
            </p>
          </div>
        </section>

        <section id="groups">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Groups &amp; configuration
          </h2>
          <div className="mt-3 space-y-3 text-[#9aa89a]">
            <p>
              Open a group detail page to edit purpose, rules, FAQs, and feature toggles.
              Core toggles:
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Welcome message · Mention replies · FAQ / questions</li>
              <li>Spam moderation · Mention notifications</li>
              <li>Daily summary hour (UTC) and delivery channels</li>
              <li>
                Advanced: shift handover, escalation ladder, living playbook, intent
                sensing, proof-of-work, incident mode, member memory, hire-in-Telegram
              </li>
              <li>
                Persona role (<code className="text-[#8cf1b7]">support</code> /{" "}
                <code className="text-[#8cf1b7]">announcer</code> /{" "}
                <code className="text-[#8cf1b7]">vip</code>) and optional tone — applied
                only when not left on default
              </li>
            </ul>
            <p>
              Add FAQs as short Q→A pairs. Strong lexical matches answer instantly;
              paraphrases fall through to the AI agent with FAQ context.
            </p>
          </div>
        </section>

        <section id="community">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Community features
          </h2>
          <dl className="mt-3 space-y-5 text-[#9aa89a]">
            <div>
              <dt className="text-lg text-[#e8f5d8]">Mentions &amp; Q&amp;A</dt>
              <dd className="mt-1">
                When mentioned or replied to, Sentry always responds (capabilities,
                enable/fund prompts, or a full answer). With Q&amp;A enabled and the bot
                able to see messages, it can answer questions proactively using FAQs and
                recent chat context.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Welcomes</dt>
              <dd className="mt-1">
                Greets new members with a short AI welcome grounded in group purpose and
                rules (when funded and welcome is on).
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Spam moderation</dt>
              <dd className="mt-1">
                Heuristic spam inspection: warn, notify admins, or delete when the bot has
                permission and confidence is high.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Mention notifications</dt>
              <dd className="mt-1">
                When someone mentions your Telegram username in an enabled group, Sentry
                can DM you a short digest (requires linked Telegram user ID).
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Personal DM assistant</dt>
              <dd className="mt-1">
                Linked employers can chat with Sentry in private: draft replies, explain
                threads, ask for status/work reports. FAQs short-circuit only on strong
                matches; everything else uses the agent with operational context.
              </dd>
            </div>
          </dl>
        </section>

        <section id="agent">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Advanced agent capacity
          </h2>
          <dl className="mt-3 space-y-5 text-[#9aa89a]">
            <div>
              <dt className="text-lg text-[#e8f5d8]">Shift handover</dt>
              <dd className="mt-1">
                Alongside the daily summary window, Sentry DMs a brief: what it handled,
                unanswered questions, and what needs a human. Toggle per group.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Escalation ladder</dt>
              <dd className="mt-1">
                High-stakes or ambiguous replies (legal, refunds, hacks, etc.) are drafted
                and sent to you with Approve / Ignore buttons. Reply{" "}
                <code className="text-[#8cf1b7]">edit: your text</code> in DM to post a
                revised version. The group sees a short “awaiting employer approval”
                note until you act.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Living playbook</dt>
              <dd className="mt-1">
                Teach Sentry your policies. In DM send{" "}
                <code className="text-[#8cf1b7]">correct: trigger → instruction</code>{" "}
                (or manage rules via API). Active rules are injected into the agent
                prompt for that employer/group.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Intent / conversion sensing</dt>
              <dd className="mt-1">
                Detects buy, support, or scam-like intent in chats and notifies you. It
                does not spam links; answers still go through FAQ/agent paths.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Incident mode</dt>
              <dd className="mt-1">
                Crisis keywords (hack, rug, outage, …) trigger a calm public notice and
                admin alerts. Deduped for a short window so the group is not flooded.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Member memory</dt>
              <dd className="mt-1">
                Off by default. When enabled, members can{" "}
                <code className="text-[#8cf1b7]">/remember …</code> (consent) and{" "}
                <code className="text-[#8cf1b7]">/forget</code>. Notes may inform later
                replies for that member in that group only.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Org-chart personas</dt>
              <dd className="mt-1">
                One hire, many groups: set support vs announcer vs VIP tone per group so
                Sentry does not sound identical everywhere.
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Hire-in-Telegram</dt>
              <dd className="mt-1">
                When tagged in a group that is not fully enabled, Sentry demos presence
                and shares a deep link to{" "}
                <code className="text-[#8cf1b7]">
                  {appUrl}/employment?hire=1
                </code>
                .
              </dd>
            </div>
            <div>
              <dt className="text-lg text-[#e8f5d8]">Proof of work</dt>
              <dd className="mt-1">
                Weekly rollup of actions and spend (also on the Dashboard). Makes prepaid
                fees tangible: what Sentry did for the money.
              </dd>
            </div>
          </dl>
        </section>

        <section id="reports">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Reports &amp; dashboard
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[#9aa89a]">
            <li>
              <strong className="text-[#e8f5d8]">Dashboard:</strong> employment status,
              balances, spend, recent actions, pending escalations, incidents, handovers,
              and proof-of-work snapshot.
            </li>
            <li>
              <strong className="text-[#e8f5d8]">Daily summary:</strong> AI bullet summary
              at the configured UTC hour (group / admins / private — per settings).
            </li>
            <li>
              <strong className="text-[#e8f5d8]">DM reports:</strong> ask Sentry for{" "}
              <em>group status</em>, <em>past work</em>, or <em>full report</em> for a
              structured operational brief.
            </li>
            <li>
              <strong className="text-[#e8f5d8]">Group detail:</strong> today’s actions,
              spend, recent mentions, moderation events, and FAQ editor.
            </li>
          </ul>
        </section>

        <section id="agent-api">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Agent-to-agent API
          </h2>
          <div className="mt-3 space-y-3 text-[#9aa89a]">
            <p>
              Other agents or backends can call Sentry over HTTP. Creating a key in
              Settings enables the API for your account. Each successful task bills an{" "}
              <strong className="text-[#e8f5d8]">agent_task</strong> charge and requires
              Active employment + available balance.
            </p>
            <h3 className="text-lg text-[#e8f5d8]">Setup</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Settings → Agent task API → Create key (copy the secret once).</li>
              <li>
                Call{" "}
                <code className="text-[#8cf1b7]">POST {appUrl}/api/agent/v1/tasks</code>
              </li>
              <li>
                Header:{" "}
                <code className="text-[#8cf1b7]">Authorization: Bearer sk_sentry_…</code>
              </li>
            </ol>
            <h3 className="mt-4 text-lg text-[#e8f5d8]">Tasks</h3>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <code className="text-[#8cf1b7]">status</code> — employment, enabled
                groups, available balance.
              </li>
              <li>
                <code className="text-[#8cf1b7]">summarize_thread</code> — body{" "}
                <code className="text-[#8cf1b7]">{`{ "task": "summarize_thread", "groupId": "…" }`}</code>
              </li>
              <li>
                <code className="text-[#8cf1b7]">answer_faq</code> — body{" "}
                <code className="text-[#8cf1b7]">{`{ "task": "answer_faq", "groupId": "…", "question": "…" }`}</code>{" "}
                (FAQ match or AI reply).
              </li>
            </ul>
            <p>
              Revoke keys anytime in Settings. Do not embed secrets in public Telegram
              messages.
            </p>
          </div>
        </section>

        <section id="commands">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Commands &amp; tips
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[#9aa89a]">
            <li>
              <code className="text-[#8cf1b7]">/start</code> <code className="text-[#8cf1b7]">/help</code>{" "}
              <code className="text-[#8cf1b7]">/status</code> — identity and employment
              snapshot
            </li>
            <li>
              <code className="text-[#8cf1b7]">/mywallet</code>{" "}
              <code className="text-[#8cf1b7]">/balance</code>{" "}
              <code className="text-[#8cf1b7]">/deposit</code> — wallet info in DM
            </li>
            <li>
              <code className="text-[#8cf1b7]">/remember</code> /{" "}
              <code className="text-[#8cf1b7]">/forget</code> — member memory (when
              enabled)
            </li>
            <li>
              DM: <code className="text-[#8cf1b7]">correct: …</code> for playbook;{" "}
              <code className="text-[#8cf1b7]">edit: …</code> for escalation edits
            </li>
            <li>
              AI uses OpenAI when configured, with Google Gemini fallback if OpenAI
              fails.
            </li>
            <li>
              If the group is silent: confirm the bot is admin (or privacy off), the group
              is Enabled, and the wallet has available balance for deeper replies.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[#e8f5d8]">
            Product links
          </h2>
          <p className="mt-3 flex flex-wrap gap-3 text-sm">
            <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
              Dashboard
            </Link>
            <Link href="/groups" className="text-[var(--accent)] hover:underline">
              Groups
            </Link>
            <Link href="/employment" className="text-[var(--accent)] hover:underline">
              Employment
            </Link>
            <Link href="/wallet" className="text-[var(--accent)] hover:underline">
              Wallet
            </Link>
            <Link href="/pricing" className="text-[var(--accent)] hover:underline">
              Pricing
            </Link>
            <Link href="/settings" className="text-[var(--accent)] hover:underline">
              Settings
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
