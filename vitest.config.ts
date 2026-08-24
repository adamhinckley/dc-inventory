import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@dc-inventory/shared-kernel": fileURLToPath(
        new URL("./packages/shared-kernel/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/identity/schema": fileURLToPath(
        new URL("./packages/identity/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/identity": fileURLToPath(
        new URL("./packages/identity/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/customers/schema": fileURLToPath(
        new URL("./packages/customers/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/customers": fileURLToPath(
        new URL("./packages/customers/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/catalog/schema": fileURLToPath(
        new URL("./packages/catalog/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/catalog": fileURLToPath(
        new URL("./packages/catalog/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/inventory/schema": fileURLToPath(
        new URL("./packages/inventory/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/inventory": fileURLToPath(
        new URL("./packages/inventory/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/api/**/*.test.ts",
      "apps/wholesale/**/*.test.ts",
      "apps/internal/**/*.test.ts",
      "packages/shared-kernel/tests/**/*.test.ts",
      "packages/identity/tests/**/*.test.ts",
      "packages/customers/tests/**/*.test.ts",
      "packages/catalog/tests/**/*.test.ts",
      "packages/inventory/tests/**/*.test.ts",
      "packages/ui/tests/**/*.test.ts",
      "packages/ui-internal/tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
