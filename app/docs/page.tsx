export default function DocsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[#e8f5d8]">
        Documentation
      </h1>
      <div className="mt-8 space-y-6 text-[#c7d6c4]">
        <section>
          <h2 className="text-xl text-[#e8f5d8]">What is Sentry?</h2>
          <p className="mt-2 text-[#9aa89a]">
            Sentry is an AI community employee for Telegram. Businesses and individuals
            hire it to monitor conversations, represent them, moderate communities, and
            generate reports while paying from a prepaid on-chain wallet.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-[#e8f5d8]">Local stack</h2>
          <p className="mt-2 text-[#9aa89a]">
            One Next.js application hosts the UI, API routes, Telegram webhook, Prisma
            data layer, and placeholder services for AI, billing, and blockchain.
          </p>
        </section>
        <section>
          <h2 className="text-xl text-[#e8f5d8]">Coming next</h2>
          <p className="mt-2 text-[#9aa89a]">
            Smart contracts, employment payments, and live Telegram work arrive in later
            prompts. This page is a shell for Prompt 1.
          </p>
        </section>
      </div>
    </main>
  );
}
