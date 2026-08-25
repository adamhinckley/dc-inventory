import { describe, expect, it } from "vitest";
import {
  DEMO_EXCLUDED_SCHEMAS,
  DEMO_OWNED_SCHEMAS,
} from "./constants.js";

function buildTruncateStatement(
  schemaName: string,
  tableNames: readonly string[],
): string {
  const quoteIdent = (identifier: string) =>
    `"${identifier.replaceAll('"', '""')}"`;
  const qualified = tableNames
    .map((tableName) => `${quoteIdent(schemaName)}.${quoteIdent(tableName)}`)
    .join(", ");
  return `TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE`;
}

describe("Postgres demo reset SQL contract", () => {
  it("targets only demo-owned schemas and never licensing or operator_bridge", () => {
    const sampleTables = ["products", "orders"] as const;
    const statements = DEMO_OWNED_SCHEMAS.map((schemaName) =>
      buildTruncateStatement(schemaName, sampleTables),
    );

    for (const statement of statements) {
      expect(statement).toContain("RESTART IDENTITY CASCADE");
      for (const excluded of DEMO_EXCLUDED_SCHEMAS) {
        expect(statement).not.toContain(`"${excluded}".`);
      }
    }

    expect(statements.join("\n")).toMatch(/"catalog"\./);
    expect(statements.join("\n")).toMatch(/"accounting"\./);
    expect(statements.join("\n")).not.toMatch(/"licensing"\./);
    expect(statements.join("\n")).not.toMatch(/"operator_bridge"\./);
  });
});
