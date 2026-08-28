import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const apiProxyOrigin = process.env.API_PROXY_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@dc-inventory/api-client-internal",
    "@dc-inventory/ui",
    "@dc-inventory/ui-internal",
  ],
  // Empty string = same-origin `/internal/*` via the rewrite below.
  // Override with NEXT_PUBLIC_API_URL when the dashboard talks to the API directly.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  async rewrites() {
    return [
      {
        source: "/internal/:path*",
        destination: `${apiProxyOrigin}/internal/:path*`,
      },
    ];
  },
};

export default nextConfig;
