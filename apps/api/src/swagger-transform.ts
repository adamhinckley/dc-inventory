import { jsonSchemaTransform } from "fastify-type-provider-zod";
import { SPREADSHEET_UPLOAD_MAX_BYTES } from "./schemas.js";

type SchemaWithTable = {
  "x-table"?: unknown;
  operationId?: string;
};

const spreadsheetImportBody = {
  type: "object",
  required: ["file"],
  properties: {
    file: {
      type: "string",
      format: "binary",
      description: `Product Browser CSV. Max ${String(SPREADSHEET_UPLOAD_MAX_BYTES)} bytes.`,
    },
  },
} as const;

const spreadsheetExportResponse = {
  description: "Spreadsheet file",
  content: {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      schema: { type: "string", format: "binary" },
    },
    "text/csv": {
      schema: { type: "string", format: "binary" },
    },
  },
} as const;

/**
 * Keep Zod JSON Schema conversion and copy `x-table` onto the OpenAPI operation.
 */
export function swaggerTransform(
  opts: Parameters<typeof jsonSchemaTransform>[0],
) {
  const transformed = jsonSchemaTransform(opts);
  const schema = opts.schema as SchemaWithTable | undefined;
  const table = schema?.["x-table"];
  if (table !== undefined && transformed.schema) {
    (transformed.schema as SchemaWithTable)["x-table"] = table;
  }
  if (schema?.operationId === "importInternalProducts" && transformed.schema) {
    const target = transformed.schema as {
      consumes?: string[];
      body?: unknown;
    };
    target.consumes = ["multipart/form-data"];
    target.body = spreadsheetImportBody;
  }
  if (schema?.operationId === "exportInternalPurchaseOrder" && transformed.schema) {
    (transformed.schema as { response?: Record<string, unknown> }).response = {
      ...(transformed.schema as { response?: Record<string, unknown> }).response,
      200: spreadsheetExportResponse,
    };
  } else if (
    (opts as { url?: string }).url?.endsWith("/purchase-orders/:id/export") &&
    transformed.schema
  ) {
    (transformed.schema as { response?: Record<string, unknown> }).response = {
      ...(transformed.schema as { response?: Record<string, unknown> }).response,
      200: spreadsheetExportResponse,
    };
  }
  return transformed;
}
