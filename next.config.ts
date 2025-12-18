import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL;
if (!BACKEND_URL) {
  throw new Error("NEXT_PUBLIC_API_URL environment variable is required");
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ordfs.network",
      },
      {
        protocol: "https",
        hostname: "*.ordfs.network",
      },
    ],
  },
  async rewrites() {
    return [
      // Proxy backend API calls (except paymail routes handled by Next.js)
      {
        source: "/api/feed",
        destination: `${BACKEND_URL}/api/feed`,
      },
      {
        source: "/api/status",
        destination: `${BACKEND_URL}/api/status`,
      },
      {
        source: "/api/avatar/:path*",
        destination: `${BACKEND_URL}/api/avatar/:path*`,
      },
      {
        source: "/api/exists/:path*",
        destination: `${BACKEND_URL}/api/exists/:path*`,
      },
      {
        source: "/api/broadcast",
        destination: `${BACKEND_URL}/api/broadcast`,
      },
      {
        source: "/u/:path*",
        destination: `${BACKEND_URL}/u/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
