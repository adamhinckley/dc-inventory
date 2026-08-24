import { InvalidIdError, type Brand } from "@dc-inventory/shared-kernel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid<B extends string>(label: B, value: string): Brand<string, B> {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidIdError(`${label} must be a UUID, got ${JSON.stringify(value)}`);
  }
  return value as Brand<string, B>;
}

export type SalesOrderLineId = Brand<string, "SalesOrderLineId">;
export const SalesOrderLineId = {
  parse(value: string): SalesOrderLineId {
    return parseUuid("SalesOrderLineId", value);
  },
};

export function newUuid(): string {
  return crypto.randomUUID();
}
