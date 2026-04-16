import type { NextConfig } from "next";

// Hosts that the Next.js dev server will accept cross-origin requests from.
// We serve the dev app through an ngrok tunnel so Clerk/Stripe webhooks can
// reach us — without listing the tunnel host here, Next.js 16 blocks
// /_next/* resources (HMR, RSC payloads, Clerk's client bootstrap, etc.)
// from that origin by default and client components silently fail to mount.
//
// This is NOT a production concern — dev-server only. In production the
// allowedDevOrigins setting is ignored entirely.
const ALLOWED_DEV_ORIGINS = [
  "getalinky.ngrok.dev",
  // Some laptops resolve localhost differently depending on LAN config —
  // listing the LAN IP makes `http://192.168.x.x:4040` work for phones/
  // second devices on the same network without further config.
  "192.168.0.186",
];

const nextConfig: NextConfig = {
  // Keep Turbopack root pinned to this project in multi-repo environments.
  turbopack: {
    root: process.cwd(),
  },
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
};

export default nextConfig;
