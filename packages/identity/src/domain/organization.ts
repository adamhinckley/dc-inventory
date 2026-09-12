import type { OrganizationId } from "@dc-inventory/shared-kernel";

export type Organization = {
  id: OrganizationId;
  name: string;
  slug: string;
};
