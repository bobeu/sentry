/**
 * Sentry Employment Agreement — versioned legal/product terms shown at hire
 * and available anytime in employer DMs.
 */
export const EMPLOYMENT_AGREEMENT_VERSION = "2026-07-22";

export const EMPLOYMENT_AGREEMENT_TITLE =
  "Sentry Employment Agreement (AI Community Employee)";

/** Compact summary for LLM system prompts — not a substitute for the full text. */
export function employmentAgreementPromptBrief() {
  return [
    `Employment Agreement v${EMPLOYMENT_AGREEMENT_VERSION} (binding when Employer accepts at hire):`,
    "- Parties: Employer (human account holder) and Sentry (AI Telegram community employee operated via the Sentry service on Celo).",
    "- Work: moderate spam, answer FAQs/KB, welcome members, summaries/reports, optional secretary/admin tools in enabled groups only.",
    "- Pay: prepaid employment wallet on Celo; bill per completed action at published rates; no work when balance exhausted.",
    "- Privacy: Employer group content used only to perform hired duties; not sold; Employer controls FAQs/KB/playbook.",
    "- Limits: Sentry is AI—not a human employee, lawyer, or fiduciary; Employer remains admin of their communities.",
    "- Termination: Employer may pause/stop; reject at hire means no employment, no wallet provisioning, no charges.",
    "If asked for the agreement, provide the full official text (or confirm version + where to re-read).",
  ].join("\n");
}

/** Full agreement body (plain text). */
export function getEmploymentAgreementText(input?: {
  employerEmail?: string | null;
  effectiveDate?: string;
}) {
  const date =
    input?.effectiveDate ??
    new Date().toISOString().slice(0, 10);
  const employer = input?.employerEmail?.trim() || "the Employer (dashboard account holder)";

  return `${EMPLOYMENT_AGREEMENT_TITLE}
Version: ${EMPLOYMENT_AGREEMENT_VERSION}
Effective / offered: ${date}

This Employment Agreement ("Agreement") is offered between:
(1) ${employer} ("Employer"); and
(2) Sentry, an AI software agent operated by the Sentry service ("Sentry"), reachable on Telegram and managed through the Sentry web dashboard on the Celo network.

By selecting Agree / Accept at hire time, Employer accepts this Agreement. If Employer selects Reject / Decline, no employment relationship is formed, Sentry will not provision an employment wallet for this hire attempt, and no billable work will begin.

────────────────────────────────
1. Nature of the relationship
────────────────────────────────
1.1 Sentry is an artificial-intelligence community employee for Telegram groups—not a human employee, contractor in the traditional labor-law sense, attorney, compliance officer, or fiduciary.
1.2 Employer remains solely responsible for their communities, moderation policies, legal compliance (including Telegram ToS and applicable privacy/employment laws), and decisions that require human judgment.
1.3 Accepting this Agreement authorizes Sentry to perform the duties described below in groups Employer enables, using FAQs, knowledge bases, playbooks, and settings Employer configures.

────────────────────────────────
2. Scope of work (scheme & context)
────────────────────────────────
2.1 Core duties (when community mode is enabled and funds allow): answer questions from FAQs/knowledge; reply to mentions; welcome members; moderate spam (warn / delete / mute / ban when admin permissions allow); send summaries and work reports; optional announcements, birthdays, secretary mode, and admin tools Employer enables.
2.2 Sentry works only in Telegram chats/groups Employer connects and enables. Sentry will not claim capabilities it is not configured or funded to perform.
2.3 Employer may set personas, playbooks, escalation rules, report cadence, and per-group settings. Corrections Employer teaches may update living playbooks for that employment.
2.4 Sentry may escalate ambiguous or high-stakes drafts to Employer when escalation is enabled.

────────────────────────────────
3. Payments, billing & Celo wallet
────────────────────────────────
3.1 Employment is prepaid. Employer funds a Sentry employment wallet on Celo (supported assets such as USDm / CELO / other enabled currencies as shown in the dashboard).
3.2 Each completed billable action creates a charge at the rates published in the Sentry Pricing page / dashboard (subject to demo or promotional adjustments if clearly labeled). Examples include mention replies, FAQ answers, spam moderation, summaries, and related agent actions.
3.3 Settlements occur on-chain according to Sentry’s settlement mode (instant or batched). Outstanding charges reduce available balance.
3.4 When available balance is insufficient, employment becomes Exhausted/Paused for billable work until Employer deposits more funds. Non-destructive account data (FAQs, settings) is retained.
3.5 Withdrawals (if enabled) go only to Employer’s confirmed withdrawal destination. Employer must protect their wallet keys; Sentry cannot recover lost keys.
3.6 Gas/network fees on Celo for Employer-initiated transfers are Employer’s responsibility.

────────────────────────────────
4. Privacy, data & confidentiality
────────────────────────────────
4.1 Purpose limitation: message content, FAQs, knowledge uploads, and operational metadata are processed to deliver hired duties, billing, security, and service improvement of Sentry—not to sell personal data to third-party advertisers.
4.2 Employer controls what is uploaded to knowledge bases and playbooks. Do not upload unlawful content or secrets you are not authorized to share.
4.3 Sentry may store conversation snippets, action logs, and reports needed for employment operations and Proof-of-Work style transparency Employer enables.
4.4 Linked Telegram user IDs, emails, and wallet addresses are account identifiers. Employer should keep dashboard access secure.
4.5 Model providers (e.g. LLM APIs) may process prompts/completions under their terms; Employer acknowledges AI inference is required for agentic duties.
4.6 Employer can request deletion or export pathways via dashboard support channels where offered; some on-chain records are immutable by design.

────────────────────────────────
5. Rights & protections
────────────────────────────────
5.1 Employer rights: pause or stop employment; enable/disable groups and capabilities; set withdrawal destinations; review reports; reject this Agreement at hire (no hire proceeds); re-read this Agreement anytime in DM (/agreement or Menu → Agreement) or the dashboard.
5.2 Sentry’s operational integrity: Sentry may refuse clearly unlawful instructions, spam campaigns, or actions that would abuse Telegram or Celo infrastructure.
5.3 No warranty of uninterrupted or error-free AI output. Employer should review high-stakes communications (legal, medical, financial advice to members) before relying on them.
5.4 Attribution: on-chain settlements may include Sentry’s public attribution tag for ecosystem transparency; this does not disclose Employer’s private chat contents.

────────────────────────────────
6. Term, termination & rejection
────────────────────────────────
6.1 Term begins when Employer accepts this Agreement and hire succeeds (wallet provisioned; status Active once funded as applicable).
6.2 Employer may pause anytime. Ending use of Sentry / disabling groups stops new billable group work; prepaid balances remain subject to dashboard withdrawal rules.
6.3 Rejection at hire: selecting Reject means Employer declines the Agreement. Sentry will take no hire action—no new employment activation and no charges for that attempt.
6.4 Sentry may update Agreement versions. Material updates require Employer acceptance of the new version before a new hire/re-hire under that version. Prior acceptance remains on record for its version.

────────────────────────────────
7. Liability & indemnity (summary)
────────────────────────────────
7.1 To the maximum extent permitted by law, Sentry and its operators are not liable for indirect, incidental, or consequential damages arising from AI mistakes, missed moderation, or third-party (Telegram/Celo) outages.
7.2 Employer agrees to use Sentry lawfully and not to instruct Sentry to harass, defraud, or illegally surveil members.
7.3 Aggregate liability related to the service is limited to fees actually paid for Sentry actions in the three (3) months preceding a claim, except where prohibited by law.

────────────────────────────────
8. Governing context
────────────────────────────────
8.1 This Agreement governs the Sentry product employment relationship described herein and is designed for use alongside Telegram’s terms and Celo network realities.
8.2 If any clause is unenforceable, the remainder stays in effect.
8.3 Questions: ask Sentry in DM (“show employment agreement” / /agreement) or review Pricing & Docs in the dashboard.

────────────────────────────────
Acceptance
────────────────────────────────
By choosing Agree, Employer confirms they have read Version ${EMPLOYMENT_AGREEMENT_VERSION}, understand prepaid action-based billing on Celo, and authorize Sentry to work in enabled Telegram groups under these terms.
By choosing Reject, Employer declines; hire does not proceed.

— End of Agreement —`;
}

export function agreementChunksForTelegram(text: string, maxLen = 3500): string[] {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
