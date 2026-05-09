import type { NextConfig } from "next";

const PHALA_BACKEND_URL = process.env.NEXT_PUBLIC_PHALA_BACKEND_URL || 'https://33d807c4df82bc98a1378c403181698f1f12bbed-8000.dstack-pha-prod9.phala.network';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/evidence/:path*',
        destination: `${PHALA_BACKEND_URL}/evidence/:path*`,
      },
    ];
  },
};

export default nextConfig;
