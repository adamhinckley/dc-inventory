import { randomUUID } from "node:crypto";
import type { OrganizationId } from "@dc-inventory/shared-kernel";

export interface SubscriptionRecord {
  id: string;
  tenantId: OrganizationId;
  plan: string;
  status: "trialing" | "active" | "past_due" | "canceled";
}

export interface SoftwarePaymentRecord {
  id: string;
  tenantId: OrganizationId;
  subscriptionId: string;
  providerRef: string;
  amountCents: number;
}

/**
 * In-memory licensing store for tests. tenant_id values are OrganizationId strings (1:1).
 */
export class InMemoryLicensingStore {
  private readonly subscriptions = new Map<string, SubscriptionRecord>();
  private readonly payments = new Map<string, SoftwarePaymentRecord>();

  createSubscription(
    tenantId: OrganizationId,
    plan: string,
    status: SubscriptionRecord["status"] = "active",
  ): SubscriptionRecord {
    const record: SubscriptionRecord = {
      id: randomUUID(),
      tenantId,
      plan,
      status,
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
    if (this.findPaymentByProviderRef(tenantId, providerRef)) {
      throw new Error(
        `duplicate software payment provider_ref for tenant ${tenantId}`,
      );
    }
    const record: SoftwarePaymentRecord = {
      id: randomUUID(),
      tenantId,
      subscriptionId,
      providerRef,
      amountCents,
    };
    this.payments.set(record.id, record);
    return record;
  }

  listSubscriptions(tenantId: OrganizationId): SubscriptionRecord[] {
    return [...this.subscriptions.values()].filter(
      (subscription) => subscription.tenantId === tenantId,
    );
  }

  listPayments(tenantId: OrganizationId): SoftwarePaymentRecord[] {
    return [...this.payments.values()].filter(
      (payment) => payment.tenantId === tenantId,
    );
  }

  findPaymentByProviderRef(
    tenantId: OrganizationId,
    providerRef: string,
  ): SoftwarePaymentRecord | undefined {
    return this.listPayments(tenantId).find(
      (payment) => payment.providerRef === providerRef,
    );
  }
}
