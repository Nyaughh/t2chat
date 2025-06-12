import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    viewTransition: true,
  },
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
};

export default nextConfig;
