import { OrganizationId } from "@dc-inventory/shared-kernel";

export function staffOrganizationId(request: {
  staffAuth?: { organizationId: string };
}): OrganizationId {
  return OrganizationId.parse(
    request.staffAuth?.organizationId ?? OrganizationId.DEFAULT,
  );
}

export function wholesaleOrganizationId(request: {
  wholesaleAuth?: { organizationId: string };
}): OrganizationId {
  return OrganizationId.parse(
    request.wholesaleAuth?.organizationId ?? OrganizationId.DEFAULT,
  );
}
