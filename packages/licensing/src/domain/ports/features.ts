import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { FeatureName } from "../features.js";

export interface IFeatures {
  isEnabled(organizationId: OrganizationId, name: FeatureName): Promise<boolean>;
}
