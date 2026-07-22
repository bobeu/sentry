/**
 * Curated Celo ecosystem references for Sentry group + employer answers.
 * Prefer linking employers/members to official sources over inventing facts.
 */
export const CELO_KNOWLEDGE = {
  tagline:
    "Sentry is built on Telegram + Celo. When questions touch Celo, MiniPay, stablecoins, builders, or Proof of Ship, ground answers in official resources below.",
  links: [
    {
      name: "Celo Docs",
      url: "https://docs.celo.org/",
      about: "Official documentation: networks, contracts, wallets, MiniPay, AI builders.",
    },
    {
      name: "Celo Docs LLM index",
      url: "https://docs.celo.org/llms.txt",
      about: "Machine-readable docs index for discovering pages.",
    },
    {
      name: "Build on Celo",
      url: "https://docs.celo.org/build-on-celo",
      about: "Builder guides and stack overview.",
    },
    {
      name: "Fund your project",
      url: "https://docs.celo.org/build-on-celo/fund-your-project",
      about: "Grants, funding programs, and how to get support.",
    },
    {
      name: "Celopedia",
      url: "https://celopedia.celo.org/",
      about: "Builder knowledge: contracts, DeFi, MiniPay, grants, agent infra.",
    },
    {
      name: "Celopedia in Celo Docs",
      url: "https://docs.celo.org/build-on-celo/build-with-ai/celopedia",
      about: "How to use Celopedia with coding assistants.",
    },
    {
      name: "Celopedia skills (GitHub)",
      url: "https://github.com/celo-org/celopedia-skills",
      about: "Installable agent skills for Celo ecosystem intelligence.",
    },
    {
      name: "Proof of Ship (Talent)",
      url: "https://talent.app/~/earn/celo-proof-of-ship",
      about: "Monthly builder shipping program with onchain scoring and rewards.",
    },
    {
      name: "Proof of Ship S2 (CeloPG)",
      url: "https://www.celopg.eco/programs/proof-of-ship-s2",
      about: "Program overview for Proof of Ship seasons.",
    },
    {
      name: "Celo Public Goods programs",
      url: "https://www.celopg.eco/programs",
      about: "Ecosystem funding and public-goods programs.",
    },
    {
      name: "CeloScan explorer",
      url: "https://celoscan.io/",
      about: "Celo mainnet block explorer.",
    },
    {
      name: "MiniPay",
      url: "https://docs.celo.org/celo-owner-guide/using-minipay",
      about: "Mobile stablecoin wallet / Mini Apps on Celo.",
    },
    {
      name: "Celo Discord / community",
      url: "https://chat.celo.org/",
      about: "Official community chat entry.",
    },
    {
      name: "Celo website",
      url: "https://celo.org/",
      about: "Product and ecosystem overview.",
    },
  ],
  tips: [
    "Celo is an EVM L2 focused on mobile-first payments and stablecoin UX (often via MiniPay).",
    "Prefer CELO / USDm / USDC / USDT as payment currencies when talking about Sentry wallets.",
    "For contract addresses, RPCs, and chain IDs — point to docs.celo.org or Celopedia; do not invent addresses.",
    "Proof of Ship rewards shipping MiniApps on Celo mainnet with public GitHub + onchain traction.",
    "Typical Proof of Ship eligibility: MiniPay hook, Celo mainnet deploy, open-source GitHub, Proof of Humanity for builders.",
    "When unsure about Celo policy or grants, say so and link Celopedia / docs / celopg.eco.",
  ],
} as const;

export function formatCeloKnowledgeForPrompt() {
  const links = CELO_KNOWLEDGE.links
    .map((l) => `- ${l.name}: ${l.url} — ${l.about}`)
    .join("\n");
  const tips = CELO_KNOWLEDGE.tips.map((t) => `- ${t}`).join("\n");
  return [
    CELO_KNOWLEDGE.tagline,
    "",
    "Official / ecosystem links:",
    links,
    "",
    "Guidance:",
    tips,
  ].join("\n");
}

/** Lightweight keyword gate so we inject Celo context when relevant. */
export function looksCeloRelated(text: string) {
  return /\b(celo|minipay|celoscan|celopedia|mento|cUSD|USDm|stCELO|proof of ship|defai|erc-?8004|x402|celo builders?|forno)\b/i.test(
    text,
  );
}
