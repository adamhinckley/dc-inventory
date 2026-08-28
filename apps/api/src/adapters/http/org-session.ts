import {
  MissingOrganizationContextError,
  OrganizationId,
  requireOrganizationId,
} from "@dc-inventory/shared-kernel";

export { MissingOrganizationContextError };

export function staffOrganizationId(request: {
  staffAuth?: { organizationId: string };
}): OrganizationId {
  return requireOrganizationId(
    request.staffAuth?.organizationId === undefined
      ? undefined
      : OrganizationId.parse(request.staffAuth.organizationId),
  );
}

export function wholesaleOrganizationId(request: {
  wholesaleAuth?: { organizationId: string };
}): OrganizationId {
  return requireOrganizationId(
    request.wholesaleAuth?.organizationId === undefined
      ? undefined
      : OrganizationId.parse(request.wholesaleAuth.organizationId),
  );
}
