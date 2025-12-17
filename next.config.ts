import type { NextConfig } from "next";

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
};

export default nextConfig;
