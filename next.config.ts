import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const nextConfig: NextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || randomUUID() },
  async redirects() {
    return [{ source: '/s=:surah(\\d+)', destination: '/?s=:surah', permanent: false }]
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.app.github.dev"],
};

export default nextConfig;
