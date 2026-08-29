import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Postgres-backed licensing acceptance test only (compose-migrate-ready CI). */
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
      "@dc-inventory/inventory/ledger-rules": fileURLToPath(
        new URL("./packages/inventory/src/domain/ledger-rules.ts", import.meta.url),
      ),
      "@dc-inventory/inventory/snapshot": fileURLToPath(
        new URL("./packages/inventory/src/domain/snapshot.ts", import.meta.url),
      ),
      "@dc-inventory/inventory": fileURLToPath(
        new URL("./packages/inventory/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/purchasing/schema": fileURLToPath(
        new URL("./packages/purchasing/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/purchasing": fileURLToPath(
        new URL("./packages/purchasing/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/sales/schema": fileURLToPath(
        new URL("./packages/sales/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/sales": fileURLToPath(
        new URL("./packages/sales/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/accounting/schema": fileURLToPath(
        new URL("./packages/accounting/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/accounting": fileURLToPath(
        new URL("./packages/accounting/src/index.ts", import.meta.url),
      ),
      "@dc-inventory/licensing/schema": fileURLToPath(
        new URL("./packages/licensing/src/persistence/schema.ts", import.meta.url),
      ),
      "@dc-inventory/licensing": fileURLToPath(
        new URL("./packages/licensing/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["apps/api/src/licensing/persistent-licensing.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
