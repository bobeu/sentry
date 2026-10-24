# Sentry Round 4 Review Questions

**Goal:** Evaluate Sentry's server-rendered HTML presentation, verify that bot reviewers can extract full body content (headings, workflow steps, disclaimers table, capabilities, observable proof), and gather actionable feedback to improve product positioning and trust.

---

## Proposed Questions for Round 4 Review

### Q1: What 3-step workflow does Sentry describe for employers on its homepage, and what specific actions occur in the "Verify" step? (Freeform)
**Type:** Freeform text  
**Expected Answer:** The workflow is **Enable → Fund → Verify**. In the **Verify** step, the employer reviews configured workflows, inspects live Telegram responses, monitors daily shift handover summaries, approves sensitive escalations, and audits transparent wallet logs on Celo.  
**Rationale:** Tests whether reviewer crawlers parse the server-rendered `<section id="workflow">` cards. In Round 3, bots failed this because JS was not executed. Now that HTML is prerendered on the server, bots should read this exact 3-step sequence.  
**Will catch:** Scrapers or bots that fail to parse static HTML body text.

---

### Q2: Which of the following statements does Sentry explicitly claim it DOES NOT do on its public verifiability matrix? (Multiselect)
**Type:** Multiselect  
**Choices:**
- [x] "Provide legal or fiduciary authority over user or employer funds"
- [x] "Operate with hidden custody or undocumented wallet control"
- [x] "Execute unapproved or unconfigured workflows without employer review"
- [x] "Offer secret privacy guarantees beyond public group chat operations"
- [ ] "Require a Celo prepaid wallet to pay for micro-actions"

**Correct Answers:** The first 4 items (items 1, 2, 3, and 4).  
**Rationale:** Directly tests whether bots extract text from the server-rendered comparison `<table>` in `<section id="verifiability">`.  
**Will catch:** Reviewers who miss the explicit disclaimers section.

---

### Q3: List any four of the six core capabilities highlighted in Sentry's feature spotlight. (Freeform)
**Type:** Freeform text  
**Expected Answer:** Any 4 of the following 6 capabilities:
1. **FAQ Support** (instant in-chat Q&A based on playbooks)
2. **Spam Moderation** (phishing link deletion & bot filter)
3. **Quizzes & Polls** (learn-and-earn trivia with member points)
4. **Shift Handover Reports** (daily activity briefs summarizing work)
5. **Adaptive Playbooks** (custom employer rules & escalation ladder)
6. **Persona Roles** (custom support/announcer/VIP tones per chat)

**Rationale:** Verifies that reviewers parse the 6 feature cards rendered in static HTML under `<section id="capabilities">`.  
**Will catch:** Reviewers giving generic non-specific feature lists.

---

### Q4: Is Sentry presented as an autonomous bot that acts independently, or does it require ongoing employer control and review? What specific evidence on the page supports your answer? (Freeform)
**Type:** Freeform text  
**Expected Answer:** Sentry is explicitly presented as **requiring ongoing employer control and review**, not as fully autonomous.  
**Evidence:** The page explicitly states: *"The employer funds a prepaid wallet and reviews the configured workflows."* Sentry cannot execute unapproved actions without employer enablement and playbook configuration.  
**Rationale:** Probes whether bots read the highlighted callout box addressing autonomous execution vs. employer control.  
**Will catch:** Bots that mischaracterize Sentry as an unmonitored autonomous agent.

---

### Q5: What billing and wallet model does Sentry describe for funding its AI employee micro-actions? (Freeform)
**Type:** Freeform text  
**Expected Answer:** A manager-controlled prepaid employment wallet on **Celo** (using USDm or CELO). Charges occur per completed micro-action with zero hidden custody and no recurring subscription. When balance reaches zero, billable agent work pauses.  
**Rationale:** Tests understanding of the economic billing model clearly detailed across the workflow, verifiability table, and hero section.  
**Will catch:** Reviewers who claim billing details or wallet mechanisms are undocumented.

---

### Q6: What specific observable proof or sample interactions does the site provide on the page to demonstrate that Sentry works? (Freeform)
**Type:** Freeform text  
**Expected Answer:** The site provides:
- An interactive simulated Telegram chat sandbox interface
- Static sample FAQ interaction text blocks (*"What currency does Sentry accept..."*)
- Static sample shift handover log text blocks (*"14 spam attempts blocked, 8 FAQs answered..."*)
- Operations dashboard and escalation interface screenshots
- Direct documentation (`/docs`) and pricing (`/pricing`) link anchors

**Rationale:** Verifies that bots detect both the interactive simulator component and the static sample workflow fallback blocks added for crawlers.  
**Will catch:** Reviewers claiming "no observable evidence" when static sample threads are rendered directly in HTML.

---

### Q7: On a scale of 1–10, how clear is Sentry's explanation of what it DOES vs. what it DOES NOT claim? (Rating 1–10)
**Type:** Rating (1–10)  
**Rationale:** Quantifies the impact of the newly added Public Verifiability Matrix table and server-rendered HTML layout.  
**Goal:** Improve score from Round 3 mean of 5.2 to 8.5+.

---

### Q8: What is the clearest strength of Sentry's updated public presentation? (Freeform)
**Type:** Freeform text  
**Rationale:** Solicits open-ended feedback on the primary design and transparency strengths (e.g., explicit disclaimers table, clear 3-step workflow, verifiable static chat examples, employer control emphasis).

---

### Q9: What specific area of ambiguity or potential friction in Sentry's presentation could be further improved? (Freeform)
**Type:** Freeform text  
**Rationale:** Geared toward product improvement. Prompts reviewers to provide constructive feedback for future landing page and product enhancements.

---

### Q10: Overall, how effectively does this page communicate that Sentry is a transparent, employer-controlled Telegram operations agent? (Freeform)
**Type:** Freeform text  
**Rationale:** Final synthesis question evaluating overall clarity, trustworthiness, and presentation quality.

---

## Submission Checklist for AskBots Dashboard (Round 4)

1. **Target URL:** `https://sentry-sigma-two.vercel.app/`
2. **Server-Rendered Status:** `app/page.tsx` is now SSR static HTML. Non-JS crawlers will successfully read all text, headings, tables, disclaimers, and links.
3. **Key Answers for Evaluation:**
   - **Q1:** Enable → Fund → Verify (Verify = employer reviews workflows, shift handovers, escalations, wallet logs).
   - **Q2:** Items 1, 2, 3, and 4 (disclaims legal authority, hidden custody, unreviewed execution, unstated privacy).
   - **Q3:** FAQ Support, Spam Moderation, Quizzes/Polls, Shift Handovers, Adaptive Playbooks, Persona Roles.
   - **Q4:** Requires ongoing employer control and review ("The employer funds a prepaid wallet and reviews the configured workflows").
   - **Q5:** Prepaid wallet on Celo (USDm/CELO), billed per micro-action, zero hidden custody.
   - **Q6:** Telegram simulator, static sample FAQ & shift handover text, dashboard screenshots, docs links.
