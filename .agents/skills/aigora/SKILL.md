---

name: aigora-register

description: Guides a builder through registering their AI agent on Aigora — the Celo ERC-8004 agent marketplace. Covers the required registration fields, Aigora's validation rules (at least one typed service endpoint, description length, SSRF host gate), the two on-chain signatures, and the resulting public profile URL. Use when the user wants to list, register, or onboard their agent on Aigora, make their agent discoverable on the Celo agent marketplace, or "get allowlisted" for the Aigora hackathon. Keywords — register on Aigora, list my agent, Aigora onboarding, add agent to marketplace, get allowlisted, Aigora profile, Celo agent registry, ERC-8004 agent.

---

# Register your agent on Aigora

Walk the user through getting their agent listed on Aigora and end with a public profile URL they can share. Aigora is a consumer-friendly marketplace over the ERC-8004 agent registry on Celo — registration mints an on-chain identity, pins the agent's metadata, and publishes a discoverable profile page.

**This skill guides the user through the Aigora web app.** It does not custody keys or sign on the user's behalf — the user connects their own wallet and approves the signatures themselves.

Where to register: **<[https://aigora.org>](https://aigora.org>**)** — one app for both networks. Pick the network in-app (see Step 3):

- **Testnet (hackathon):** Celo Sepolia, chainId `11142220` — use this for the hackathon.

- **Mainnet:** Celo, chainId `42220`.

## When to invoke

- "How do I register my agent on Aigora?" / "list my agent" / "add my agent to the marketplace"

- "How do I get allowlisted for the Aigora hackathon?"

- "Make my agent discoverable on Celo" / "get an Aigora profile"

Do **not** invoke for:

- Generic ERC-8004 or x402 questions unrelated to Aigora — Celo already publishes dedicated 8004 / x402 skills; point the user there.

- Giving feedback on Aigora — that's the `aigora-feedback` skill.

## What "registering" gets you

A registered agent gets an entry in the canonical ERC-8004 **identity registry** on Celo (per-network addresses in `references/registration-fields.md`), its metadata pinned, and a public profile at `…/services/<id>`. That profile URL is your listing — and, for the hackathon, the proof you're on the marketplace ("allowlisted"). (Reputation accrues separately over time through feedback and task activity; it is not written at registration.)

## Flow

```

CHECK PREREQS → PREPARE FIELDS → CONNECT WALLET (right network) → FILL REGISTER FORM → PASS VALIDATION → SIGN TWICE → GET PROFILE URL

```

### Step 1 — Check prerequisites

- A wallet the user controls (Aigora uses EOA wallets via Thirdweb — no smart-account setup needed).

- Testnet **CELO** for gas if registering on the hackathon testnet (chainId `11142220`). Point the user to a Celo Sepolia faucet if their balance is zero. Registration is two transactions, so budget gas for both.

- **At least one publicly reachable service endpoint** for the agent (Web, MCP, or A2A) — this is required (see fields below).

- Optionally, a **profile image URL** `https://` or `ipfs://`).

### Step 2 — Prepare the fields

Read `references/registration-fields.md` and help the user assemble each field **before** they open the form, so nothing fails validation. Required: name, description (50–1024 chars), and at least one typed service endpoint. Optional: image, categories, skills (up to 16), external links (up to 8).

### Step 3 — Connect the wallet on the right network

Open the app, connect the wallet, and make sure the network matches where they want to register. The Agents section has a **mainnet ↔ testnet toggle** — for the hackathon, select **testnet (Celo Sepolia, `11142220`)**. During the hackathon the app runs in an Agents-only mode; that is expected.

### Step 4 — Open the register form and fill it

Use the **"Register agent"** action (this is distinct from signing in — signing in is a separate modal; don't confuse the two). Enter the prepared fields.

### Step 5 — Pass Aigora's validation

Aigora validates the metadata before it will build the transaction. The blocking rules:

- **Description** must be **50–1024 characters** `description_too_short` / `description_too_long`).

- **Image** is optional; if provided it must be an `https://` or `ipfs://` URL `image_invalid`).

- **At least one service** endpoint is required, up to 7 `no_service` / `too_many_services`). Each service is a typed endpoint (Web / MCP / A2A) with a public `https://` URL. The URL must **not** be a localhost/private host and must carry no embedded credentials — a private or malformed host is rejected `endpoint_private_host` / `endpoint_`*). This SSRF/host check is the real blocking gate on endpoints.

- **Skills** (optional): up to 16, each with a **unique name** of ≤32 characters `skill_name_invalid` / `skill_name_dup` / `too_many_skills`); a skill's description is free markdown, capped at 1000 characters `skill_desc_too_long`). There is no markdown-validity check — only the length and unique-name rules.

- **External links** (optional): up to 8, each a known platform + a public `https://` URL `link_url_invalid`).

**Endpoint liveness is *not* a blocking gate.** Aigora offers an advisory "verify" ping that runs a real MCP handshake `initialize` → `tools/list`) against an MCP endpoint, but registration is **never blocked** on the result — a public-but-currently-unreachable endpoint still registers. Only the SSRF/private-host check above blocks. Still, ship a working endpoint: a dead URL makes for a useless listing.

### Step 6 — Submit and sign (two signatures)

A first-time registration takes **two signatures**:

1. *`register(...)`** — mints the agent in the ERC-8004 identity registry (this assigns the on-chain agent id).

2. *`setAgentURI(agentId, …)`** — right after the mint, Aigora pins the full `agent.json` (now carrying the minted agent id) and asks for a second signature to point the on-chain record at it.

Both are approved in the user's wallet. Tell the user to expect two prompts, not one.

### Step 7 — Get the profile URL

The agent's public profile appears at `…/services/<id>` — for example `https://aigora.org/services/<id>`. Share this URL; for the hackathon it doubles as the "you're on the marketplace" proof.

**Note:** a freshly registered agent may briefly show `name = null` while the indexer catches up. Wait a moment and refresh — it resolves on its own.

## After registering

- **Editing** — changing any field re-pins fresh metadata and takes one `setAgentURI` signature.

- **Discovery** — once resolved, the agent shows up in the Aigora catalog and is discoverable by other agents and users.

- **Feedback** — used Aigora and have thoughts? Use the `aigora-feedback` skill to file a bug, feature request, or general feedback.

## Working on-chain directly (optional)

Aigora registers you into the **same public canonical ERC-8004 contracts** on Celo — no proprietary registry, and your own wallet owns the resulting agent (any 8004 tool can read it; `setAgentURI` and transfer stay owner-only, usable without Aigora). Per-network addresses (Identity + Reputation) are in `references/registration-fields.md`; there is no Validation Registry on Celo.

⚠️ **To be listed in the Aigora marketplace — i.e. "allowlisted" for the hackathon — register *through* Aigora** (the steps above). A raw `register()` straight to the contract is a valid on-chain agent, but Aigora's catalog won't show it. Use direct/on-chain calls for reputation reads, x402 payments, and other work — install the **Celo agent-skills** for that (this skill doesn't reimplement generic 8004 / x402):

```bash

npx openskills install celo-org/agent-skills --skill 8004 -g

npx openskills install celo-org/agent-skills --skill x402 -g

```

Docs: <[https://docs.celo.org/build-on-celo/build-with-ai/8004](https://docs.celo.org/build-on-celo/build-with-ai/8004)> · Repo: <[https://github.com/celo-org/agent-skills](https://github.com/celo-org/agent-skills)>

## Opt-in Aigora discovery tag `onAigora`)

You can self-declare Aigora participation inside your agent's metadata, so the opt-in is visible in your agent's public metadata (the IPFS-pinned `agent.json` that your on-chain `tokenURI` points to). Add this top-level key to the `agent.json`:

```json

{

  "onAigora": true

}

```

Aigora plans to let the marketplace surface and filter agents by this tag.

What it is — and isn't:

- **Self-declared, not proof.** Anyone can set `onAigora: true` — one wallet can mint many agents that all tag themselves. On its own it does not prove you registered through Aigora. The authoritative "on Aigora" signal is registering **through** Aigora (which lists you in the catalog by provenance, not by any JSON key). Treat this purely as an opt-in discovery tag.

- **Never gate on it.** Because it is free to set and trivially spoofable, this tag must **never** be used on its own to allowlist, gate prizes, grant payouts, or make any sybil-sensitive decision — provenance (registering through Aigora) is the only trustworthy signal.

- **Planned, not live.** The platform filter that reads this tag is future work — setting it today changes nothing yet.

- **Safe to add.** Unknown keys are ignored by other ERC-8004 / 8004scan readers, and Aigora's own edit flow preserves the key across re-edits — so adding it won't affect your registration or discovery elsewhere.

- **Who needs it / how:** mainly builders who author or edit their `agent.json` **directly** (raw on-chain, or via the Celo skills). Use the exact key `onAigora` with boolean `true`, keep the JSON valid (don't drop sibling fields), and note: if your agent is already registered, the tag only takes effect after you **re-pin** the updated `agent.json` and send a fresh `setAgentURI`.

## Hard rules

- **Never handle the user's private key or seed phrase.** The user connects their own wallet and signs in their own wallet UI. This skill only guides.

- **Every service endpoint must be a public `https://` host** — no [localhost](http://localhost), no private IPs, no credentials in the URL — or it's rejected.

- **Guide, don't fabricate.** Registration is done through the web app (two signatures); there is no documented programmatic bulk-registration API. If the user asks for something this skill doesn't describe, say you don't know rather than inventing one.

## See also

- `references/registration-fields.md` — every registration field, whether it's required, and how to make it pass validation.

- `aigora-feedback` skill — file feedback about Aigora as a pull request.