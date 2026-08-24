import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dc-inventory/shared-kernel": fileURLToPath(
        new URL("../shared-kernel/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/inventory": fileURLToPath(
        new URL("../inventory/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
