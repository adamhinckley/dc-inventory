import {
  CustomerId,
  MissingOrganizationContextError,
  OrganizationId,
  requireOrganizationId,
} from "@dc-inventory/shared-kernel";

export { MissingOrganizationContextError };

type WholesaleAuthRequest = {
  wholesaleAuth?: {
    customerId: string | null;
  };
};

export function wholesaleCustomerId(request: WholesaleAuthRequest): CustomerId {
  return CustomerId.parse(request.wholesaleAuth?.customerId ?? "");
}

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
