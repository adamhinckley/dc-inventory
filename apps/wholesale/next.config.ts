import type { NextConfig } from "next";

const apiProxyOrigin = process.env.API_PROXY_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@dc-inventory/api-client-wholesale"],
  // Empty string = same-origin `/wholesale/*` via the rewrite below.
  // Override with NEXT_PUBLIC_API_URL when the shop talks to the API directly.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "",
  },
  webpack: (config) => {
    // Orval clients use TypeScript ESM `.js` specifiers that point at `.ts` files.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    };
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/wholesale/:path*",
        destination: `${apiProxyOrigin}/wholesale/:path*`,
      },
    ];
  },
};

export default nextConfig;
