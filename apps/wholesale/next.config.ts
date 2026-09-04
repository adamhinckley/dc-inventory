import type { NextConfig } from "next";

/** Baked at build time — Vercel blocks rewrites to localhost (DNS_HOSTNAME_RESOLVED_PRIVATE). */
function apiProxyOrigin(): string {
  if (process.env.API_PROXY_ORIGIN) {
    return process.env.API_PROXY_ORIGIN;
  }
  if (process.env.VERCEL === "1") {
    return "https://dc-inventory-api.fly.dev";
  }
  return "http://localhost:3001";
}

const nextConfig: NextConfig = {
  transpilePackages: ["@dc-inventory/api-client-wholesale"],
  // Cursor/simple-browser preview throws on Next's indicator SVG when the
  // viewport changes (Permission denied: correspondingUseElement).
  devIndicators: false,
  // Empty string = same-origin `/wholesale/*` via the rewrite below.
  // Override with NEXT_PUBLIC_API_URL when the shop talks to the API directly.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  async rewrites() {
    return [
      {
        source: "/wholesale/:path*",
        destination: `${apiProxyOrigin()}/wholesale/:path*`,
      },
    ];
  },
};

export default nextConfig;
