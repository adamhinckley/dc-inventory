import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";

type JsonObject = Record<string, unknown>;

type TableColumn = {
  field: string;
  label: string;
};

type TableSearch = {
  param: string;
  fields: string[];
  placeholder: string;
};

type TableFilter = {
  param: string;
  control: "select" | "text" | "date" | "dateRange" | "boolean";
  rangePair?: string;
};

type TableSort = {
  defaultBy: string;
  defaultOrder: "asc" | "desc";
  fields: string[];
};

type TableMetadata = {
  rowId: string;
  columns: TableColumn[];
  search?: TableSearch;
  filters?: TableFilter[];
  sort?: TableSort;
  export?: { formats: ("csv" | "xlsx")[] };
  import?: { template: boolean };
};

type GeneratedTable = {
  operationId: string;
  metadata: TableMetadata;
};

const HTTP_METHODS = new Set([
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
]);

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

function object(value: unknown, context: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail(context, "expected an object");
  }
  return value as JsonObject;
}

function array(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    return fail(context, "expected an array");
  }
  return value;
}

function string(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) {
    return fail(context, "expected a non-empty string");
  }
  return value;
}

function strictKeys(value: JsonObject, allowed: readonly string[], context: string): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    fail(context, `unknown key "${unknown[0]}"`);
  }
}

function resolveRef(document: JsonObject, value: unknown, context: string): JsonObject {
  let current = object(value, context);
  const seen = new Set<string>();
  while ("$ref" in current) {
    const ref = string(current.$ref, `${context}.$ref`);
    if (!ref.startsWith("#/")) {
      fail(context, `external reference "${ref}" is not supported`);
    }
    if (seen.has(ref)) {
      fail(context, `circular reference "${ref}"`);
    }
    seen.add(ref);
    let resolved: unknown = document;
    for (const encodedSegment of ref.slice(2).split("/")) {
      const segment = encodedSegment.replaceAll("~1", "/").replaceAll("~0", "~");
      resolved = object(resolved, context)[segment];
    }
    current = object(resolved, `${context} (${ref})`);
  }
  return current;
}

function schemaProperties(
  document: JsonObject,
  schemaValue: unknown,
  context: string,
): JsonObject {
  const schema = resolveRef(document, schemaValue, context);
  return object(schema.properties, `${context}.properties`);
}

function schemaAtField(
  document: JsonObject,
  rowSchema: JsonObject,
  field: string,
  context: string,
): JsonObject {
  let current = rowSchema;
  for (const segment of field.split(".")) {
    const properties = object(current.properties, `${context}.properties`);
    if (!(segment in properties)) {
      fail(context, `field "${field}" is not present in the response item schema`);
    }
    current = resolveRef(document, properties[segment], `${context}.${segment}`);
  }
  return current;
}

function queryParameters(
  document: JsonObject,
  operation: JsonObject,
  context: string,
): Map<string, JsonObject> {
  const parameters = operation.parameters === undefined
    ? []
    : array(operation.parameters, `${context}.parameters`);
  const result = new Map<string, JsonObject>();
  for (const [index, value] of parameters.entries()) {
    const parameter = resolveRef(document, value, `${context}.parameters[${index}]`);
    if (parameter.in !== "query") {
      continue;
    }
    const name = string(parameter.name, `${context}.parameters[${index}].name`);
    if (result.has(name)) {
      fail(context, `duplicate query parameter "${name}"`);
    }
    result.set(name, parameter);
  }
  return result;
}

function parameterSchema(
  document: JsonObject,
  parameter: JsonObject,
  context: string,
): JsonObject {
  return resolveRef(document, parameter.schema, `${context}.schema`);
}

function schemaVariants(document: JsonObject, schema: JsonObject, context: string): JsonObject[] {
  const variants = schema.anyOf ?? schema.oneOf;
  if (variants === undefined) {
    return [schema];
  }
  return array(variants, `${context}.variants`).map((value, index) =>
    resolveRef(document, value, `${context}.variants[${index}]`),
  );
}

function schemaHasType(
  document: JsonObject,
  schema: JsonObject,
  type: string,
  context: string,
): boolean {
  return schemaVariants(document, schema, context).some((variant) => variant.type === type);
}

function schemaEnum(
  document: JsonObject,
  schema: JsonObject,
  context: string,
): string[] | undefined {
  for (const variant of schemaVariants(document, schema, context)) {
    if (Array.isArray(variant.enum) && variant.enum.every((value) => typeof value === "string")) {
      return variant.enum as string[];
    }
  }
  return undefined;
}

function validateControl(
  document: JsonObject,
  filter: TableFilter,
  parameter: JsonObject,
  context: string,
): void {
  const schema = parameterSchema(document, parameter, context);
  if (filter.control === "boolean") {
    if (!schemaHasType(document, schema, "boolean", context)) {
      fail(context, `boolean control does not match parameter "${filter.param}"`);
    }
    return;
  }
  if (filter.control === "select") {
    if (schemaEnum(document, schema, context) === undefined) {
      fail(context, `select control requires an enum parameter "${filter.param}"`);
    }
    return;
  }
  if (!schemaHasType(document, schema, "string", context)) {
    fail(context, `${filter.control} control requires a string parameter "${filter.param}"`);
  }
}

function parseMetadata(
  document: JsonObject,
  operation: JsonObject,
  context: string,
): TableMetadata {
  const raw = object(operation["x-table"], `${context}.x-table`);
  strictKeys(
    raw,
    ["rowId", "columns", "search", "filters", "sort", "export", "import"],
    `${context}.x-table`,
  );

  const response = object(
    object(operation.responses, `${context}.responses`)["200"],
    `${context}.responses.200`,
  );
  const content = object(response.content, `${context}.responses.200.content`);
  const media = object(
    content["application/json"],
    `${context}.responses.200.content.application/json`,
  );
  const envelope = resolveRef(document, media.schema, `${context}.responses.200.schema`);
  const envelopeProperties = schemaProperties(document, envelope, `${context}.response`);
  for (const required of ["items", "page", "pageSize", "total"]) {
    if (!(required in envelopeProperties)) {
      fail(context, `200 response is missing list envelope property "${required}"`);
    }
  }
  const itemsSchema = resolveRef(document, envelopeProperties.items, `${context}.response.items`);
  if (itemsSchema.type !== "array") {
    fail(context, "200 response items must be an array");
  }
  const rowSchema = resolveRef(document, itemsSchema.items, `${context}.response.items.items`);
  const params = queryParameters(document, operation, context);

  const rowId = string(raw.rowId, `${context}.x-table.rowId`);
  schemaAtField(document, rowSchema, rowId, context);

  const columns = array(raw.columns, `${context}.x-table.columns`).map((value, index) => {
    const column = object(value, `${context}.x-table.columns[${index}]`);
    strictKeys(column, ["field", "label"], `${context}.x-table.columns[${index}]`);
    const parsed = {
      field: string(column.field, `${context}.x-table.columns[${index}].field`),
      label: string(column.label, `${context}.x-table.columns[${index}].label`),
    };
    schemaAtField(document, rowSchema, parsed.field, context);
    return parsed;
  });
  if (columns.length === 0) {
    fail(context, "x-table.columns must not be empty");
  }
  if (new Set(columns.map(({ field }) => field)).size !== columns.length) {
    fail(context, "x-table.columns contains duplicate fields");
  }

  let search: TableSearch | undefined;
  if (raw.search !== undefined) {
    const value = object(raw.search, `${context}.x-table.search`);
    strictKeys(value, ["param", "fields", "placeholder"], `${context}.x-table.search`);
    search = {
      param: string(value.param, `${context}.x-table.search.param`),
      fields: array(value.fields, `${context}.x-table.search.fields`).map((field, index) =>
        string(field, `${context}.x-table.search.fields[${index}]`),
      ),
      placeholder: string(value.placeholder, `${context}.x-table.search.placeholder`),
    };
    if (!params.has(search.param)) {
      fail(context, `search parameter "${search.param}" is not declared by the operation`);
    }
    if (search.fields.length === 0) {
      fail(context, "x-table.search.fields must not be empty");
    }
    for (const field of search.fields) {
      schemaAtField(document, rowSchema, field, context);
    }
  }

  let filters: TableFilter[] | undefined;
  if (raw.filters !== undefined) {
    filters = array(raw.filters, `${context}.x-table.filters`).map((value, index) => {
      const itemContext = `${context}.x-table.filters[${index}]`;
      const filter = object(value, itemContext);
      strictKeys(filter, ["param", "control", "rangePair"], itemContext);
      const control = string(filter.control, `${itemContext}.control`);
      if (!["select", "text", "date", "dateRange", "boolean"].includes(control)) {
        fail(itemContext, `unsupported control "${control}"`);
      }
      const parsed: TableFilter = {
        param: string(filter.param, `${itemContext}.param`),
        control: control as TableFilter["control"],
      };
      if (filter.rangePair !== undefined) {
        parsed.rangePair = string(filter.rangePair, `${itemContext}.rangePair`);
      }
      if (parsed.control === "dateRange" && parsed.rangePair === undefined) {
        fail(itemContext, "dateRange control requires rangePair");
      }
      if (parsed.control !== "dateRange" && parsed.rangePair !== undefined) {
        fail(itemContext, "rangePair is only valid for dateRange controls");
      }
      const parameter = params.get(parsed.param);
      if (parameter === undefined) {
        fail(context, `filter parameter "${parsed.param}" is not declared by the operation`);
      }
      validateControl(document, parsed, parameter, itemContext);
      if (parsed.rangePair !== undefined) {
        const pair = params.get(parsed.rangePair);
        if (pair === undefined) {
          fail(context, `rangePair parameter "${parsed.rangePair}" is not declared by the operation`);
        }
        validateControl(document, { param: parsed.rangePair, control: "date" }, pair, itemContext);
      }
      return parsed;
    });
  }

  let sort: TableSort | undefined;
  if (raw.sort !== undefined) {
    const value = object(raw.sort, `${context}.x-table.sort`);
    strictKeys(value, ["defaultBy", "defaultOrder", "fields"], `${context}.x-table.sort`);
    const defaultOrder = string(value.defaultOrder, `${context}.x-table.sort.defaultOrder`);
    if (defaultOrder !== "asc" && defaultOrder !== "desc") {
      fail(context, `unsupported defaultOrder "${defaultOrder}"`);
    }
    sort = {
      defaultBy: string(value.defaultBy, `${context}.x-table.sort.defaultBy`),
      defaultOrder,
      fields: array(value.fields, `${context}.x-table.sort.fields`).map((field, index) =>
        string(field, `${context}.x-table.sort.fields[${index}]`),
      ),
    };
    const sortBy = params.get("sortBy");
    const sortOrder = params.get("sortOrder");
    if (sortBy === undefined || sortOrder === undefined) {
      fail(context, "x-table.sort requires sortBy and sortOrder query parameters");
    }
    const sortBySchema = parameterSchema(document, sortBy, `${context}.parameters.sortBy`);
    const sortOrderSchema = parameterSchema(document, sortOrder, `${context}.parameters.sortOrder`);
    const sortByValues = schemaEnum(document, sortBySchema, context);
    const sortOrderValues = schemaEnum(document, sortOrderSchema, context);
    if (sortByValues === undefined || sortOrderValues === undefined) {
      fail(context, "sortBy and sortOrder query parameters must be enums");
    }
    if (sort.fields.length === 0 || sort.fields.some((field) => !sortByValues.includes(field))) {
      fail(context, "x-table.sort.fields must be a non-empty subset of the sortBy enum");
    }
    if (!sort.fields.includes(sort.defaultBy) || sortBySchema.default !== sort.defaultBy) {
      fail(context, "x-table.sort.defaultBy must match the sortBy schema default");
    }
    if (!sortOrderValues.includes(sort.defaultOrder) || sortOrderSchema.default !== sort.defaultOrder) {
      fail(context, "x-table.sort.defaultOrder must match the sortOrder schema default");
    }
    for (const field of sort.fields) {
      schemaAtField(document, rowSchema, field, context);
    }
  }

  let exportMetadata: TableMetadata["export"];
  if (raw.export !== undefined) {
    const value = object(raw.export, `${context}.x-table.export`);
    strictKeys(value, ["formats"], `${context}.x-table.export`);
    const formats = array(value.formats, `${context}.x-table.export.formats`).map(
      (format, index) => {
        const parsed = string(format, `${context}.x-table.export.formats[${index}]`);
        if (parsed !== "csv" && parsed !== "xlsx") {
          fail(context, `unsupported export format "${parsed}"`);
        }
        return parsed;
      },
    );
    exportMetadata = { formats };
  }

  let importMetadata: TableMetadata["import"];
  if (raw.import !== undefined) {
    const value = object(raw.import, `${context}.x-table.import`);
    strictKeys(value, ["template"], `${context}.x-table.import`);
    if (typeof value.template !== "boolean") {
      fail(context, "x-table.import.template must be a boolean");
    }
    importMetadata = { template: value.template };
  }

  return {
    rowId,
    columns,
    ...(search === undefined ? {} : { search }),
    ...(filters === undefined ? {} : { filters }),
    ...(sort === undefined ? {} : { sort }),
    ...(exportMetadata === undefined ? {} : { export: exportMetadata }),
    ...(importMetadata === undefined ? {} : { import: importMetadata }),
  };
}

export function extractTableMetadata(documentValue: unknown): GeneratedTable[] {
  const document = object(documentValue, "OpenAPI document");
  const paths = object(document.paths, "OpenAPI document.paths");
  const generated: GeneratedTable[] = [];
  const operationIds = new Set<string>();

  for (const [pathName, pathValue] of Object.entries(paths)) {
    const pathItem = object(pathValue, `path ${pathName}`);
    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || operationValue === undefined) {
        continue;
      }
      const operation = object(operationValue, `${method.toUpperCase()} ${pathName}`);
      if (operation["x-table"] === undefined) {
        continue;
      }
      const context = `${method.toUpperCase()} ${pathName}`;
      const operationId = string(operation.operationId, `${context}.operationId`);
      if (!/^[$A-Z_a-z][$\w]*$/.test(operationId)) {
        fail(context, `operationId "${operationId}" is not a TypeScript identifier`);
      }
      if (operationIds.has(operationId)) {
        fail(context, `duplicate operationId "${operationId}"`);
      }
      operationIds.add(operationId);
      generated.push({
        operationId,
        metadata: parseMetadata(document, operation, context),
      });
    }
  }

  return generated.sort((left, right) => left.operationId.localeCompare(right.operationId));
}

export function generateTableMetadataSource(document: unknown): string {
  const tables = extractTableMetadata(document);
  const declarations = tables
    .map(
      ({ operationId, metadata }) =>
        `export const ${operationId}Table = ${JSON.stringify(metadata, null, 2)} as const satisfies InternalTableMetadata;`,
    )
    .join("\n\n");
  const registry = tables
    .map(({ operationId }) => `  ${operationId}: ${operationId}Table,`)
    .join("\n");

  return `// Generated by pnpm gen:api from openapi/internal.yaml. Do not edit.
export type InternalTableMetadata = {
  readonly rowId: string;
  readonly columns: readonly { readonly field: string; readonly label: string }[];
  readonly search?: {
    readonly param: string;
    readonly fields: readonly string[];
    readonly placeholder: string;
  };
  readonly filters?: readonly {
    readonly param: string;
    readonly control: "select" | "text" | "date" | "dateRange" | "boolean";
    readonly rangePair?: string;
  }[];
  readonly sort?: {
    readonly defaultBy: string;
    readonly defaultOrder: "asc" | "desc";
    readonly fields: readonly string[];
  };
  readonly export?: { readonly formats: readonly ("csv" | "xlsx")[] };
  readonly import?: { readonly template: boolean };
};

${declarations}

export const internalTableMetadata = {
${registry}
} as const;

export type InternalTableOperationId = keyof typeof internalTableMetadata;
`;
}

export async function writeTableMetadata(
  openApiPath: string,
  outputPath: string,
): Promise<void> {
  const source = await readFile(openApiPath, "utf8");
  const document: unknown = parse(source);
  await writeFile(outputPath, generateTableMetadataSource(document), "utf8");
}
