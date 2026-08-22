import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const config: StorybookConfig = {
  stories: [
    "../packages/ui/src/**/*.stories.@(ts|tsx)",
    "../packages/ui-internal/src/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-themes"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  async viteFinal(config) {
    const nodeEnv = JSON.stringify(process.env.NODE_ENV ?? "development");
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      define: {
        "process.env.NODE_ENV": nodeEnv,
      },
      optimizeDeps: {
        esbuildOptions: {
          define: {
            "process.env.NODE_ENV": nodeEnv,
          },
        },
      },
      resolve: {
        alias: [
          {
            find: "@dc-inventory/ui",
            replacement: join(rootDir, "packages/ui/src/index.ts"),
          },
          {
            find: "@dc-inventory/ui-internal",
            replacement: join(rootDir, "packages/ui-internal/src/index.ts"),
          },
          {
            find: "#cn",
            replacement: join(rootDir, "packages/ui/src/lib/cn.ts"),
          },
          {
            find: /^#ds\//,
            replacement: `${join(rootDir, "packages/ui/src")}/`,
          },
          {
            find: /^#shared\//,
            replacement: `${join(rootDir, "packages/ui/src/shared")}/`,
          },
          {
            find: "next/navigation",
            replacement: join(rootDir, ".storybook/mocks/next-navigation.ts"),
          },
          {
            find: "next/link",
            replacement: join(rootDir, ".storybook/mocks/next-link.tsx"),
          },
          {
            find: "next/image",
            replacement: join(rootDir, ".storybook/mocks/next-image.tsx"),
          },
          {
            find: "@tanstack/react-query",
            replacement: join(rootDir, "packages/ui/node_modules/@tanstack/react-query"),
          },
          {
            find: "@base-ui-components/react",
            replacement: join(rootDir, "packages/ui/node_modules/@base-ui-components/react"),
          },
        ],
      },
    });
  },
};

export default config;
