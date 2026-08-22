import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "tests/**/*.test.ts",
      "apps/api/**/*.test.ts",
      "apps/wholesale/**/*.test.ts",
      "apps/internal/**/*.test.ts",
      "packages/shared-kernel/tests/**/*.test.ts",
      "packages/ui/tests/**/*.test.ts",
      "packages/ui-internal/tests/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
