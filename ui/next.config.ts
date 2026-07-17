import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [],
  experimental: {
    // Ensure instrumentation.ts loads the scheduler in Node runtime
  },
};

export default nextConfig;
