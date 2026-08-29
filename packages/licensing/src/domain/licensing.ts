import type { OrganizationId } from "@dc-inventory/shared-kernel";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";
export type SoftwarePaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type SoftwarePaymentKind = "subscription" | "add_on" | "manual";
export type SoftwarePaymentProvider = "stripe" | "manual";

export interface SubscriptionRecord {
  id: string;
  tenantId: OrganizationId;
  plan: string;
  status: SubscriptionStatus;
  periodStart: Date;
  periodEnd: Date;
  providerRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftwarePaymentRecord {
  id: string;
  tenantId: OrganizationId;
  subscriptionId: string;
  amountCents: number;
  currency: string;
  status: SoftwarePaymentStatus;
  kind: SoftwarePaymentKind;
  occurredAt: Date;
  provider: SoftwarePaymentProvider;
  providerRef: string | null;
  memo: string | null;
  createdAt: Date;
  updatedAt: Date;
}
