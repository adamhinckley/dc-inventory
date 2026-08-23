import { InvalidIdError, type Brand } from "@dc-inventory/shared-kernel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid<B extends string>(label: B, value: string): Brand<string, B> {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidIdError(`${label} must be a UUID, got ${JSON.stringify(value)}`);
  }
  return value as Brand<string, B>;
}

export type ContactId = Brand<string, "ContactId">;
export const ContactId = {
  parse(value: string): ContactId {
    return parseUuid("ContactId", value);
  },
};

export type ShipToId = Brand<string, "ShipToId">;
export const ShipToId = {
  parse(value: string): ShipToId {
    return parseUuid("ShipToId", value);
  },
};

export type ExemptionCertificateId = Brand<string, "ExemptionCertificateId">;
export const ExemptionCertificateId = {
  parse(value: string): ExemptionCertificateId {
    return parseUuid("ExemptionCertificateId", value);
  },
};

export function newUuid(): string {
  return crypto.randomUUID();
}
