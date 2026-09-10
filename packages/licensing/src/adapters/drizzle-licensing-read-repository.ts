import { OrganizationId } from "@dc-inventory/shared-kernel";
import { desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { TenantFeatureState } from "../domain/features.js";
import type {
  SoftwarePaymentRecord,
  SubscriptionRecord,
} from "../domain/licensing.js";
import type {
  ILicensingReadRepository,
  LicensingListQuery,
  LicensingListPage,
} from "../domain/ports/licensing-read-repository.js";
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

  async listSubscriptions(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SubscriptionRecord>> {
    const where = eq(subscriptions.tenantId, tenantId);
    const offset = (query.page - 1) * query.pageSize;
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(subscriptions)
        .where(where)
        .orderBy(desc(subscriptions.createdAt))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(subscriptions)
        .where(where),
    ]);
    return {
      items: rows.map(toSubscription),
      total: countRows[0]?.count ?? 0,
    };
  }

  async listPayments(
    tenantId: OrganizationId,
    query: LicensingListQuery,
  ): Promise<LicensingListPage<SoftwarePaymentRecord>> {
    const where = eq(softwarePayments.tenantId, tenantId);
    const offset = (query.page - 1) * query.pageSize;
    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(softwarePayments)
        .where(where)
        .orderBy(desc(softwarePayments.occurredAt))
        .limit(query.pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(softwarePayments)
        .where(where),
    ]);
    return {
      items: rows.map(toPayment),
      total: countRows[0]?.count ?? 0,
    };
  }

  async getLatestSubscription(tenantId: OrganizationId): Promise<SubscriptionRecord | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    const row = rows[0];
    return row === undefined ? null : toSubscription(row);
  }

  async getFeatureState(tenantId: OrganizationId): Promise<TenantFeatureState> {
    const subscription = await this.getLatestSubscription(tenantId);
    if (subscription === null) {
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
