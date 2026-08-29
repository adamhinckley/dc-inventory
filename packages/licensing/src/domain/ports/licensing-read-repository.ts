import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { TenantFeatureState } from "../features.js";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../licensing.js";

export interface ILicensingReadRepository {
  listSubscriptions(tenantId: OrganizationId): Promise<SubscriptionRecord[]>;
  listPayments(tenantId: OrganizationId): Promise<SoftwarePaymentRecord[]>;
  getFeatureState(tenantId: OrganizationId): Promise<TenantFeatureState>;
}
