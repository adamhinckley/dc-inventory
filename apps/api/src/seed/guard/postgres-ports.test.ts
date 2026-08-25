import { describe, expect, it, vi } from "vitest";
import {
  DEMO_EXCLUDED_SCHEMAS,
  DEMO_OWNED_SCHEMAS,
} from "./constants.js";
import {
  buildSchemaTruncateSql,
  PostgresDemoBookReset,
} from "./postgres-ports.js";

describe("buildSchemaTruncateSql", () => {
  it("builds RESTART IDENTITY CASCADE truncates for demo-owned schemas only", () => {
    const statements = DEMO_OWNED_SCHEMAS.map((schemaName) =>
      buildSchemaTruncateSql(schemaName, ["sample_table"]),
    ).filter((statement): statement is string => statement !== null);

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

describe("PostgresDemoBookReset", () => {
  it("truncates only demo-owned schemas inside one transaction", async () => {
    const unsafeCalls: string[] = [];
    const tableRows: Record<string, { table_name: string }[]> = {
      catalog: [{ table_name: "products" }],
      licensing: [{ table_name: "subscriptions" }],
    };

    const tx = Object.assign(
      vi.fn(
        async <T extends readonly object[]>(
          _strings: TemplateStringsArray,
          schemaName: unknown,
        ): Promise<T> => (tableRows[String(schemaName)] ?? []) as T,
      ),
      {
        unsafe: vi.fn(async (query: string) => {
          unsafeCalls.push(query);
          return [];
        }),
      },
    );

    const sql = {
      begin: vi.fn(async (fn: (inner: typeof tx) => Promise<void>) => {
        await fn(tx);
      }),
    };

    await new PostgresDemoBookReset(sql as never).resetDemoOwnedSchemas();

    expect(sql.begin).toHaveBeenCalledOnce();
    expect(unsafeCalls).toHaveLength(1);
    expect(unsafeCalls[0]).toBe(
      buildSchemaTruncateSql("catalog", ["products"]),
    );
    expect(unsafeCalls[0]).not.toContain('"licensing".');
    expect(unsafeCalls[0]).not.toContain('"operator_bridge".');
  });
});
