import { OrganizationId } from "./ids.js";

export class MissingOrganizationContextError extends Error {
  constructor(message = "Missing organization context") {
    super(message);
    this.name = "MissingOrganizationContextError";
  }
}

export function requireOrganizationId(
  organizationId: OrganizationId | undefined,
): OrganizationId {
  if (organizationId === undefined) {
    throw new MissingOrganizationContextError();
  }
  return organizationId;
}
