import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const nextConfig: NextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || randomUUID() },
  async headers() {
    return ['/data/:path*', '/offline-manifest.json'].map(source => ({ source, headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] }))
  },
  async redirects() {
    return [{ source: '/s=:surah(\\d+)', destination: '/?s=:surah', permanent: false }]
  },
  async rewrites() {
    return [
      { source: '/s/:s(\\d+)/a/:a(\\d+)/w/:w(\\d+)', destination: '/' },
      { source: '/s/:s(\\d+)/a/:a(\\d+)', destination: '/' },
      { source: '/s/:s(\\d+)', destination: '/' },
      { source: '/p/:p(\\d+)', destination: '/' },
      { source: '/surah/:s(\\d+)/ayah/:a(\\d+)/word/:w(\\d+)', destination: '/' },
      { source: '/surah/:s(\\d+)/ayah/:a(\\d+)', destination: '/' },
      { source: '/surah/:s(\\d+)', destination: '/' },
      { source: '/page/:p(\\d+)', destination: '/' },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.app.github.dev"],
};

export default nextConfig;
