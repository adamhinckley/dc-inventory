import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "#cn": path.resolve(__dirname, "src/lib/cn.ts"),
      "#ds": path.resolve(__dirname, "src"),
      "#shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
