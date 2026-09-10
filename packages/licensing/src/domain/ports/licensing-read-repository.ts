import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { TenantFeatureState } from "../features.js";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../licensing.js";

export type LicensingListQuery = {
  page: number;
  pageSize: number;
};

export type LicensingListPage<T> = {
  items: T[];
  total: number;
};

export interface ILicensingReadRepository {
  listSubscriptions(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SubscriptionRecord>>;
  listPayments(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SoftwarePaymentRecord>>;
  getLatestSubscription(tenantId: OrganizationId): Promise<SubscriptionRecord | null>;
  getFeatureState(tenantId: OrganizationId): Promise<TenantFeatureState>;
}
