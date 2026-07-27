import type { NextConfig } from "next";
import path from "path";

const stub = path.join(__dirname, "lib", "empty-module.js");

const nextConfig: NextConfig = {
  // Prisma Compute expects standalone; Vercel uses its own bundler and ignores this.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  transpilePackages: [],
  experimental: {},
  // Large marketing PNGs in /public — skip sharp at build/runtime to avoid OOM hangs.
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      // Optional wallet SDKs pulled by wagmi connector barrel — stub for Next builds.
      "@base-org/account": stub,
      "@coinbase/cdp-sdk": stub,
      "@x402/evm": stub,
      "@x402/svm": stub,
      "@x402/svm/exact/client": stub,
      "@x402/svm/exact": stub,
    };
    return config;
  },
};

export default nextConfig;
