import type { NextConfig } from "next";

const PHALA_BACKEND_URL = process.env.NEXT_PUBLIC_PHALA_BACKEND_URL || 'http://localhost:8000';

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
