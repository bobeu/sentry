import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Compute expects standalone; Vercel uses its own bundler and ignores this.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  transpilePackages: [],
  experimental: {
    // Ensure instrumentation.ts loads the scheduler in Node runtime
  },
};

export default nextConfig;
