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
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@dc-inventory/ui": join(rootDir, "packages/ui/src/index.ts"),
          "@dc-inventory/ui-internal": join(
            rootDir,
            "packages/ui-internal/src/index.ts",
          ),
        },
      },
    });
  },
};

export default config;
