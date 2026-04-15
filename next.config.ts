import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack root pinned to this project in multi-repo environments.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
