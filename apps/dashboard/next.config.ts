import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/sign_and_execute',
        destination: process.env.PHALA_ENFORCE_URL || 'https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/sign_and_execute',
      },
      {
        source: '/api/evidence/:path*',
        destination: 'https://c27b0861a2bf2891f43f3556d3aa9526d704f7bc-8000.dstack-pha-prod5.phala.network/evidence/:path*',
      },
    ];
  },
};

export default nextConfig;
