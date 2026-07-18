import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by Prisma Compute for Next.js standalone packaging
  output: "standalone",
  transpilePackages: [],
  experimental: {
    // Ensure instrumentation.ts loads the scheduler in Node runtime
  },
};

export default nextConfig;
