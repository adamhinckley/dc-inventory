import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const extensionAliasLoader = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/turbopack-extension-alias-loader.cjs",
);

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
  turbopack: {
    // Orval clients emit TypeScript ESM `.js` specifiers. Webpack used
    // resolve.extensionAlias; Next 16.3 Turbopack does not, so this loader
    // strips the suffix and default resolveExtensions finds `.ts`.
    rules: {
      "*.ts": {
        condition: { not: "foreign" },
        loaders: [extensionAliasLoader],
      },
      "*.tsx": {
        condition: { not: "foreign" },
        loaders: [extensionAliasLoader],
      },
    },
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
