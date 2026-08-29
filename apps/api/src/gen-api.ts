import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeOpenApiYaml } from "./export-openapi.js";
import { writeTableMetadata } from "./generate-table-metadata.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

await writeOpenApiYaml(repoRoot);
await writeTableMetadata(
  path.join(repoRoot, "openapi/internal.yaml"),
  path.join(
    repoRoot,
    "packages/api-client-internal/src/generated/table-metadata.ts",
  ),
);

const result = spawnSync("pnpm", ["exec", "orval"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
