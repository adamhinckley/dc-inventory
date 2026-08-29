import { describe, expect, it } from "vitest";
import {
  extractTableMetadata,
  generateTableMetadataSource,
} from "./generate-table-metadata";

function validDocument(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    paths: {
      "/internal/widgets": {
        get: {
          operationId: "listInternalWidgets",
          parameters: [
            { in: "query", name: "q", schema: { type: "string" } },
            {
              in: "query",
              name: "status",
              schema: { type: "string", enum: ["active", "archived"] },
            },
            {
              in: "query",
              name: "sortBy",
              schema: { type: "string", enum: ["name"], default: "name" },
            },
            {
              in: "query",
              name: "sortOrder",
              schema: { type: "string", enum: ["asc", "desc"], default: "asc" },
            },
          ],
          "x-table": {
            rowId: "id",
            columns: [
              { field: "name", label: "Name" },
              { field: "detail.code", label: "Code" },
            ],
            search: {
              param: "q",
              fields: ["name"],
              placeholder: "Search widgets",
            },
            filters: [{ param: "status", control: "select" }],
            sort: {
              defaultBy: "name",
              defaultOrder: "asc",
              fields: ["name"],
            },
          },
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            name: { type: "string" },
                            detail: {
                              type: "object",
                              properties: { code: { type: "string" } },
                            },
                          },
                        },
                      },
                      page: { type: "integer" },
                      pageSize: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function operation(document: Record<string, unknown>): Record<string, unknown> {
  return (
    document.paths as Record<string, Record<string, Record<string, unknown>>>
  )["/internal/widgets"].get;
}

describe("table metadata generation", () => {
  it("writes typed constants and an operation-id registry", () => {
    const source = generateTableMetadataSource(validDocument());

    expect(source).toContain(
      "export const listInternalWidgetsTable =",
    );
    expect(source).toContain("as const satisfies InternalTableMetadata");
    expect(source).toContain(
      "listInternalWidgets: listInternalWidgetsTable",
    );
    expect(extractTableMetadata(validDocument())).toHaveLength(1);
  });

  it("rejects malformed x-table data", () => {
    const document = validDocument();
    const table = operation(document)["x-table"] as Record<string, unknown>;
    table.columns = [{ field: "name" }];

    expect(() => extractTableMetadata(document)).toThrow(
      /columns\[0\]\.label: expected a non-empty string/,
    );
  });

  it("rejects columns that do not exist on response rows", () => {
    const document = validDocument();
    const table = operation(document)["x-table"] as Record<string, unknown>;
    table.columns = [{ field: "missing", label: "Missing" }];

    expect(() => extractTableMetadata(document)).toThrow(
      /field "missing" is not present in the response item schema/,
    );
  });

  it("rejects filters that do not match operation query parameters", () => {
    const document = validDocument();
    const table = operation(document)["x-table"] as Record<string, unknown>;
    table.filters = [{ param: "missing", control: "text" }];

    expect(() => extractTableMetadata(document)).toThrow(
      /filter parameter "missing" is not declared by the operation/,
    );
  });

  it("rejects sort metadata when the operation cannot accept sorting", () => {
    const document = validDocument();
    operation(document).parameters = (
      operation(document).parameters as Record<string, unknown>[]
    ).filter((parameter) => parameter.name !== "sortBy");

    expect(() => extractTableMetadata(document)).toThrow(
      /x-table\.sort requires sortBy and sortOrder query parameters/,
    );
  });
});
