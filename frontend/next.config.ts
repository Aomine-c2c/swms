import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.TAURI_ENV_PLATFORM ? "export" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
