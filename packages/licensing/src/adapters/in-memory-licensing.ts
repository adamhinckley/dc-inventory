import { randomUUID } from "node:crypto";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { evaluateFeature, type FeatureName, type TenantFeatureState } from "../domain/features.js";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
  SubscriptionStatus,
} from "../domain/licensing.js";
import type { IFeatures } from "../domain/ports/features.js";
import type {
  ILicensingReadRepository,
  LicensingListQuery,
  LicensingListPage,
} from "../domain/ports/licensing-read-repository.js";
import type { ILicensingTenantProvisioner } from "../domain/ports/licensing-tenant-provisioner.js";

export class InMemoryLicensingStore implements ILicensingReadRepository, ILicensingTenantProvisioner {
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private readonly payments = new Map<string, SoftwarePaymentRecord>();
  private readonly overrides = new Map<OrganizationId, TenantFeatureState["flagOverrides"]>();

  createSubscription(
    tenantId: OrganizationId,
    plan: string,
    status: SubscriptionStatus = "active",
  ): SubscriptionRecord {
    const now = new Date();
    const record: SubscriptionRecord = {
      id: randomUUID(),
      tenantId,
      plan,
      status,
      periodStart: now,
      periodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      providerRef: null,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.set(record.id, record);
    return record;
  }

  recordPayment(
    tenantId: OrganizationId,
    subscriptionId: string,
    providerRef: string,
    amountCents = 1000,
  ): SoftwarePaymentRecord {
    if ([...this.payments.values()].some(
      (payment) => payment.tenantId === tenantId && payment.providerRef === providerRef,
    )) {
      throw new Error(`duplicate software payment provider_ref for tenant ${tenantId}`);
    }
    const now = new Date();
    const record: SoftwarePaymentRecord = {
      id: randomUUID(),
      tenantId,
      subscriptionId,
      providerRef,
      amountCents,
      currency: "USD",
      status: "succeeded",
      kind: "manual",
      occurredAt: now,
      provider: "manual",
      memo: null,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.set(record.id, record);
    return record;
  }

  setFlagOverrides(
    tenantId: OrganizationId,
    overrides: TenantFeatureState["flagOverrides"],
  ): void {
    this.overrides.set(tenantId, overrides);
  }

  private listAllSubscriptions(tenantId: OrganizationId): SubscriptionRecord[] {
    return [...this.subscriptions.values()]
      .filter((subscription) => subscription.tenantId === tenantId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  private listAllPayments(tenantId: OrganizationId): SoftwarePaymentRecord[] {
    return [...this.payments.values()]
      .filter((payment) => payment.tenantId === tenantId)
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
  }

  async listSubscriptions(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SubscriptionRecord>> {
    const rows = this.listAllSubscriptions(tenantId);
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }

  async listPayments(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SoftwarePaymentRecord>> {
    const rows = this.listAllPayments(tenantId);
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(offset, offset + query.pageSize),
      total: rows.length,
    };
  }

  async getLatestSubscription(tenantId: OrganizationId): Promise<SubscriptionRecord | null> {
    return this.listAllSubscriptions(tenantId)[0] ?? null;
  }

  async findPaymentByProviderRef(
    tenantId: OrganizationId,
    providerRef: string,
  ): Promise<SoftwarePaymentRecord | undefined> {
    return this.listAllPayments(tenantId).find(
      (payment) => payment.providerRef === providerRef,
    );
  }

  async getFeatureState(tenantId: OrganizationId): Promise<TenantFeatureState> {
    const subscription = await this.getLatestSubscription(tenantId);
    return {
      subscriptionStatus: subscription?.status ?? null,
      flagOverrides: this.overrides.get(tenantId) ?? [],
    };
  }

  async ensureEmptyTenant(tenantId: OrganizationId): Promise<void> {
    const existing = await this.getLatestSubscription(tenantId);
    if (existing !== null) {
      return;
    }
    this.createSubscription(tenantId, "twin", "trialing");
  }
}

export class InMemoryFeatures implements IFeatures {
  constructor(
    private readonly tenantStates: ReadonlyMap<OrganizationId, TenantFeatureState> = new Map(),
    private readonly defaultCoreOn = true,
  ) {}

  async isEnabled(organizationId: OrganizationId, name: FeatureName): Promise<boolean> {
    const state = this.tenantStates.get(organizationId);
    if (!state) {
      return this.tenantStates.size === 0 && this.defaultCoreOn;
    }
    return evaluateFeature(state, name);
  }
}

export function featuresAllCoreOn(): InMemoryFeatures {
  return new InMemoryFeatures();
}
