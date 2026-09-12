import { InvalidIdError, type Brand, type OrganizationId } from "@dc-inventory/shared-kernel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OpsUserId = Brand<string, "OpsUserId">;

export const OpsUserId = {
  parse(value: string): OpsUserId {
    if (!UUID_PATTERN.test(value)) {
      throw new InvalidIdError(`OpsUserId must be a UUID, got ${JSON.stringify(value)}`);
    }
    return value as OpsUserId;
  },
};

export type OpsActorKind = "operator" | "business_owner";

export type OpsUser = {
  id: OpsUserId;
  tenantId: OrganizationId;
  displayName: string;
  email: string;
  passwordHash: string;
  kind: OpsActorKind;
};
