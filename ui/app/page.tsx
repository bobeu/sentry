import Link from "next/link";
import { HeroSlideshow, ChatSimulator, FeatureCarousel } from "@/components/homepage/interactive";

/**
 * Server Component: Prerenders all product documentation, workflows, disclaimers,
 * and capabilities directly into the HTML source code.
 * Crawlers and AskBots review bots that perform static HTTP GET requests see 100% of
 * headings, text, links, and proof without executing JavaScript.
 */
export default function HomePage() {
  return (
    <main className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden bg-bg-light">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(0,82,255,0.06),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 hero-noise" />

      {/* ------------------ SECTION 1: HERO SECTION ------------------ */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 sm:pt-20 sm:pb-16">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-bold text-primary">
              <span>🛡️ AI Telegram Employee for Communities</span>
            </div>

            <h1 className="font-sans text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-text-dark leading-[1.08]">
              Sentry <br />
              <span className="text-primary">
                Telegram ops for real communities
              </span>
            </h1>

            <p className="max-w-xl text-base sm:text-lg text-muted font-medium leading-relaxed">
              Sentry is an employer-controlled Telegram community operations agent. It answers FAQs, moderates spam, hosts learn-and-earn quizzes, and sends daily shift summaries. Work is funded from a prepaid Celo wallet with visible limits and zero hidden custody.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/login"
                className="rounded-full bg-accent px-8 py-3.5 text-sm font-bold text-slate-900 shadow-md hover:bg-accent/90 transition-all hover:scale-105"
              >
                Hire Sentry
              </Link>
              <Link
                href="/docs"
                className="rounded-full border border-primary/20 bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/5 transition-all"
              >
                See the workflow
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 pt-2">
              <div className="rounded-2xl border border-primary/10 bg-white p-3.5 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">FAQ Support</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Instant chat answers</div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-white p-3.5 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Moderation</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Spam link filter</div>
              </div>
              <div className="rounded-2xl border border-primary/10 bg-white p-3.5 shadow-sm">
                <div className="text-[10px] uppercase tracking-[0.18em] text-primary font-bold">Daily Reports</div>
                <div className="mt-1 text-sm font-extrabold text-text-dark">Shift handovers</div>
              </div>
            </div>
          </div>

          {/* Interactive Slideshow Client Component */}
          <div className="lg:col-span-6">
            <HeroSlideshow />
          </div>
        </div>
      </section>

      {/* ------------------ SECTION 2: 3-STEP WORKFLOW ------------------ */}
      <section id="workflow" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Employer Control Architecture</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
            Simple 3-Step Employer Workflow: Enable → Fund → Verify
          </h2>
          <p className="text-muted max-w-2xl mx-auto text-base font-medium">
            Sentry is not an autonomous black box. The employer enables specific features, funds the prepaid wallet, and verifies all chat outputs and shift reports.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-primary/15 bg-white p-7 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-primary mb-3">
                Step 1: Enable
              </div>
              <h3 className="text-xl font-extrabold text-text-dark">Configure &amp; Connect</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted font-medium">
                The employer adds Sentry (<code className="text-primary font-bold font-mono">@tgemployee_bot</code>) to their Telegram group and selects allowed capabilities: FAQ support, spam moderation, quizzes, daily reports, or shift handovers.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-primary">✓ Employer retains full toggle control</div>
          </div>

          <div className="rounded-3xl border border-primary/15 bg-white p-7 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-primary mb-3">
                Step 2: Fund
              </div>
              <h3 className="text-xl font-extrabold text-text-dark">Prepaid Wallet Deposit</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted font-medium">
                The employer deposits funds (USDm/CELO) into a dedicated prepaid employment wallet on Celo. Billed per action with transparent micro-charges. When balance reaches zero, billable agent work pauses.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-primary">✓ Zero hidden custody or recurring subscription</div>
          </div>

          <div className="rounded-3xl border border-primary/15 bg-white p-7 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="inline-block rounded-full bg-accent/30 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.15em] text-slate-900 mb-3">
                Step 3: Verify
              </div>
              <h3 className="text-xl font-extrabold text-text-dark">Review &amp; Audit Work</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted font-medium">
                <strong>Purpose of Verify:</strong> The employer reviews configured workflows, inspects live Telegram responses, monitors daily shift handover summaries, approves sensitive escalations, and audits the transparent wallet transaction logs.
              </p>
            </div>
            <div className="pt-2 text-xs font-bold text-slate-900 font-extrabold">✓ Verifiable outputs &amp; shift logs</div>
          </div>
        </div>
      </section>

      {/* ------------------ SECTION 3: 6 CORE CAPABILITIES spotlight ------------------ */}
      <section id="capabilities" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Product Feature Spotlight</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
            What Sentry Can Do: 6 Core Agent Capabilities
          </h2>
          <p className="text-muted max-w-2xl mx-auto text-base font-medium">
            Sentry combines automated chat moderation, community engagement, and employer reporting into a single hireable agent.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">💬</div>
            <h3 className="text-lg font-extrabold text-text-dark">1. FAQ Support</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Answers community questions instantly in Telegram chat based on the employer’s custom playbook and uploaded knowledge base.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="text-lg font-extrabold text-text-dark">2. Spam Moderation</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Detects and removes malicious phishing links, scam bots, and unverified promo messages to keep community chats safe.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">🎮</div>
            <h3 className="text-lg font-extrabold text-text-dark">3. Quizzes &amp; Polls</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Hosts learn-and-earn trivia, interactive member polls, and engagement challenges with member points and optional Celo rewards.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="text-lg font-extrabold text-text-dark">4. Shift Handover Reports</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Delivers structured daily activity briefs summarizing FAQs answered, spam removed, points awarded, and remaining wallet balance.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">📜</div>
            <h3 className="text-lg font-extrabold text-text-dark">5. Adaptive Playbooks</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Employers teach Sentry rules in plain text. High-stakes edge cases trigger an escalation approval ladder to the employer.
            </p>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-sm">
            <div className="text-2xl mb-2">🎭</div>
            <h3 className="text-lg font-extrabold text-text-dark">6. Persona Roles</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted font-medium">
              Assign distinct personality roles (Support Agent, News Announcer, VIP Concierge) customized per enabled Telegram chat.
            </p>
          </div>
        </div>

        {/* Feature Carousel Client Component */}
        <FeatureCarousel />
      </section>

      {/* ------------------ SECTION 4: INTERACTIVE DEMO SIMULATOR ------------------ */}
      <section id="demo" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="text-center space-y-3 mb-12">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Observable Runtime Proof</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
            Watch Sentry Work in Real-Time
          </h2>
          <p className="text-muted max-w-xl mx-auto font-medium">
            Review simulated Telegram threads demonstrating FAQ resolution, spam deletion, quiz hosting, and daily handover briefs.
          </p>
        </div>

        {/* Chat Simulator Client Component */}
        <ChatSimulator />

        {/* Static HTML Fallback for Static Crawlers */}
        <div className="mt-8 rounded-2xl border border-primary/10 bg-white p-6 shadow-sm text-xs space-y-4">
          <h3 className="font-extrabold text-sm text-text-dark">Static Sample Workflows</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-3 bg-bg-light rounded-xl">
              <div className="font-bold text-primary">Sample FAQ Interaction:</div>
              <p className="mt-1 text-muted"><strong>User:</strong> &quot;What currency does Sentry accept and how do I deposit funds?&quot;</p>
              <p className="mt-1 text-text-dark"><strong>Sentry:</strong> &quot;Sentry operates using a manager-controlled prepaid wallet on Celo. It accepts USDm/CELO. Deposit via MetaMask/MiniPay on the dashboard.&quot;</p>
            </div>
            <div className="p-3 bg-bg-light rounded-xl">
              <div className="font-bold text-primary">Sample Shift Handover Log:</div>
              <p className="mt-1 text-muted"><strong>Employer:</strong> &quot;@tgemployee_bot report status&quot;</p>
              <p className="mt-1 text-text-dark"><strong>Sentry:</strong> &quot;📊 Shift Handover (UTC 12:00-20:00): 14 spam attempts blocked, 8 FAQs answered, 3 quiz rounds held, balance 4.85 USDm.&quot;</p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------ SECTION 5: PUBLIC STATEMENTS & DISCLAIMERS TABLE ------------------ */}
      <section id="verifiability" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 border-t border-primary/10">
        <div className="rounded-3xl border border-primary/15 bg-white p-6 shadow-md sm:p-10 space-y-8">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-primary">Public Verifiability Matrix</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-text-dark sm:text-4xl">
              What Sentry Does vs. What Sentry Claims NOT to Do
            </h2>
            <p className="mt-2 text-base text-muted font-medium">
              We provide explicit public disclaimers regarding legal authority, fund custody, employer review, and autonomous execution.
            </p>
          </div>

          {/* Detailed Statement Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse border border-primary/10 text-sm">
              <thead>
                <tr className="bg-primary/5 border-b border-primary/10">
                  <th className="p-4 font-extrabold text-primary w-1/2">Verified Product Claims (What Sentry Does)</th>
                  <th className="p-4 font-extrabold text-red-600 w-1/2">Explicit Disclaimers (What Sentry Claims NOT to Do)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                <tr>
                  <td className="p-4 font-medium text-text-dark">
                    <strong>1. Telegram Community Operations Agent:</strong> Answers community FAQs, moderates spam, hosts trivia, and posts shift summaries in enabled groups.
                  </td>
                  <td className="p-4 font-medium text-muted">
                    <strong>1. NO Legal or Fiduciary Authority:</strong> Sentry does NOT claim legal or fiduciary authority over user or employer funds.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-text-dark">
                    <strong>2. Prepaid Wallet Billing on Celo:</strong> Uses an explicit prepaid on-chain wallet. Charges occur per completed micro-action.
                  </td>
                  <td className="p-4 font-medium text-muted">
                    <strong>2. NO Hidden Custody:</strong> Sentry does NOT operate with hidden custody or undocumented wallet control.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-text-dark">
                    <strong>3. Employer-Controlled Workflows:</strong> All workflows require employer enablement, playbook configuration, and wallet funding.
                  </td>
                  <td className="p-4 font-medium text-muted">
                    <strong>3. NO Unreviewed Autonomous Execution:</strong> Sentry does NOT execute unapproved or unconfigured workflows without employer review.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-text-dark">
                    <strong>4. Transparent Output Logs:</strong> All chat responses, shift summaries, and spend balances are visible to group members and admins.
                  </td>
                  <td className="p-4 font-medium text-muted">
                    <strong>4. NO Secret Privacy Guarantees:</strong> Sentry does NOT offer unstated privacy guarantees beyond public group chat operations.
                  </td>
                </tr>
                <tr>
                  <td className="p-4 font-medium text-text-dark">
                    <strong>5. AI Automation Layer:</strong> Utilizes LLM agents for natural language FAQ answering under employer-provided playbooks.
                  </td>
                  <td className="p-4 font-medium text-muted">
                    <strong>5. NO Human Employee Requirement:</strong> Sentry does NOT require human employees to manually operate the Telegram group.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Autonomous Execution Callout Box */}
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 space-y-2">
            <h3 className="text-lg font-extrabold text-primary">
              Is Sentry presented as autonomous, or does it require ongoing employer control and review?
            </h3>
            <p className="text-sm font-medium text-text-dark leading-relaxed">
              <strong>Answer:</strong> Sentry is explicitly presented as <strong>requiring ongoing employer control and review</strong>, not as fully autonomous.
            </p>
            <p className="text-xs text-muted font-medium">
              <strong>Evidence from the page:</strong> &quot;The employer funds a prepaid wallet and reviews the configured workflows.&quot; Sentry cannot operate without employer enablement, custom playbook rules, and prepaid funding.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------ SECTION 6: FOOTER CTAS & LINKS ------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 border-t border-primary/10 text-center space-y-6">
        <h2 className="text-2xl font-extrabold text-text-dark">Ready to Hire Sentry for Your Community?</h2>
        <p className="text-muted max-w-lg mx-auto text-sm font-medium">
          Get started in minutes. Connect your wallet, set up your group, and experience verifiable AI operations.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/login"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-primary/90 transition-all"
          >
            Hire Sentry Now
          </Link>
          <Link
            href="/docs"
            className="rounded-full border border-primary/20 bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/5 transition-all"
          >
            Read Documentation
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-primary/20 bg-white px-8 py-3.5 text-sm font-bold text-primary shadow-sm hover:bg-primary/5 transition-all"
          >
            View Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
