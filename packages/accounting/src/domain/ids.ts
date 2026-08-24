import { InvalidIdError, type Brand } from "@dc-inventory/shared-kernel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid<B extends string>(label: B, value: string): Brand<string, B> {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidIdError(`${label} must be a UUID, got ${JSON.stringify(value)}`);
  }
  return value as Brand<string, B>;
}

export type PaymentId = Brand<string, "PaymentId">;
export const PaymentId = {
  parse(value: string): PaymentId {
    return parseUuid("PaymentId", value);
  },
};

export type PaymentApplicationId = Brand<string, "PaymentApplicationId">;
export const PaymentApplicationId = {
  parse(value: string): PaymentApplicationId {
    return parseUuid("PaymentApplicationId", value);
  },
};

export function newUuid(): string {
  return crypto.randomUUID();
}
