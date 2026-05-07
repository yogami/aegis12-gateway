import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/evidence/:path*',
        destination: 'https://c2fa9527475ea371388de812f47be1676bc59712-8000.dstack-pha-prod9.phala.network/evidence/:path*',
      },
    ];
  },
};

export default nextConfig;
