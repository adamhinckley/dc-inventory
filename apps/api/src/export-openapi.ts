import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { type Audience, buildAudienceApp } from "./app.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export async function exportOpenApiYaml(): Promise<Record<Audience, string>> {
  const out: Record<Audience, string> = {
    internal: "",
    wholesale: "",
    ops: "",
  };

  for (const audience of ["internal", "wholesale", "ops"] as const) {
    const app = await buildAudienceApp(audience);
    const spec = app.swagger();
    out[audience] = stringify(spec);
    await app.close();
  }

  return out;
}

export async function writeOpenApiYaml(
  root = repoRoot,
): Promise<Record<Audience, string>> {
  const specs = await exportOpenApiYaml();
  const dir = path.join(root, "openapi");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "internal.yaml"), specs.internal, "utf8");
  await writeFile(path.join(dir, "wholesale.yaml"), specs.wholesale, "utf8");
  await writeFile(path.join(dir, "ops.yaml"), specs.ops, "utf8");
  return specs;
}
