import { jsonSchemaTransform } from "fastify-type-provider-zod";

type SchemaWithTable = {
  "x-table"?: unknown;
};

/**
 * Keep Zod JSON Schema conversion and copy `x-table` onto the OpenAPI operation.
 */
export function swaggerTransform(
  opts: Parameters<typeof jsonSchemaTransform>[0],
) {
  const transformed = jsonSchemaTransform(opts);
  const table = (opts.schema as SchemaWithTable | undefined)?.["x-table"];
  if (table !== undefined && transformed.schema) {
    (transformed.schema as SchemaWithTable)["x-table"] = table;
  }
  return transformed;
}
