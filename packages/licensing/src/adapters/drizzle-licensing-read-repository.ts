import { OrganizationId } from "@dc-inventory/shared-kernel";
import { desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TenantFeatureState } from "../domain/features.js";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../domain/licensing.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";
import {
  flagOverrides,
  softwarePayments,
  subscriptions,
} from "../persistence/schema.js";

export type LicensingDrizzle = PostgresJsDatabase<{
  subscriptions: typeof subscriptions;
  softwarePayments: typeof softwarePayments;
  flagOverrides: typeof flagOverrides;
}>;

function toSubscription(row: typeof subscriptions.$inferSelect): SubscriptionRecord {
  return {
    id: row.id,
    tenantId: OrganizationId.parse(row.tenantId),
    plan: row.plan,
    status: row.status,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    providerRef: row.providerRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPayment(row: typeof softwarePayments.$inferSelect): SoftwarePaymentRecord {
  return {
    id: row.id,
    tenantId: OrganizationId.parse(row.tenantId),
    subscriptionId: row.subscriptionId,
    amountCents: row.amountCents,
    currency: row.currency,
    status: row.status,
    kind: row.kind,
    occurredAt: row.occurredAt,
    provider: row.provider,
    providerRef: row.providerRef,
    memo: row.memo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleLicensingReadRepository implements ILicensingReadRepository {
  constructor(private readonly db: LicensingDrizzle) {}

  async listSubscriptions(tenantId: OrganizationId): Promise<SubscriptionRecord[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt));
    return rows.map(toSubscription);
  }

  async listPayments(tenantId: OrganizationId): Promise<SoftwarePaymentRecord[]> {
    const rows = await this.db
      .select()
      .from(softwarePayments)
      .where(eq(softwarePayments.tenantId, tenantId))
      .orderBy(desc(softwarePayments.occurredAt));
    return rows.map(toPayment);
  }

  async getFeatureState(tenantId: OrganizationId): Promise<TenantFeatureState> {
    const subscriptionRows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    const subscription = subscriptionRows[0];
    if (!subscription) {
      return { subscriptionStatus: null, flagOverrides: [] };
    }
    const overrides = await this.db
      .select({
        featureName: flagOverrides.featureName,
        direction: flagOverrides.direction,
      })
      .from(flagOverrides)
      .where(eq(flagOverrides.subscriptionId, subscription.id));
    return {
      subscriptionStatus: subscription.status,
      flagOverrides: overrides,
    };
  }
}
