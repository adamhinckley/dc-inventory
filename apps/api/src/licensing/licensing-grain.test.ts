import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryFeatures } from "../features.js";
import { InMemoryLicensingStore } from "./in-memory-licensing.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("licensing tenant grain (ADA-166)", () => {
  it("isolates subscriptions and software payments by tenant_id", () => {
    const store = new InMemoryLicensingStore();
    const acmeSubscription = store.createSubscription(DEFAULT_ORG, "core");
    const betaSubscription = store.createSubscription(BETA_ORG, "core");

    store.recordPayment(DEFAULT_ORG, acmeSubscription.id, "pi_shared_ref");
    store.recordPayment(BETA_ORG, betaSubscription.id, "pi_shared_ref");

    expect(store.listSubscriptions(DEFAULT_ORG)).toEqual([acmeSubscription]);
    expect(store.listSubscriptions(BETA_ORG)).toEqual([betaSubscription]);
    expect(store.listPayments(DEFAULT_ORG)).toHaveLength(1);
    expect(store.listPayments(BETA_ORG)).toHaveLength(1);
    expect(store.findPaymentByProviderRef(DEFAULT_ORG, "pi_shared_ref")).toBeDefined();
    expect(store.findPaymentByProviderRef(BETA_ORG, "pi_shared_ref")).toBeDefined();
    expect(store.listPayments(DEFAULT_ORG)[0]?.tenantId).toBe(DEFAULT_ORG);
    expect(store.listPayments(BETA_ORG)[0]?.tenantId).toBe(BETA_ORG);
  });

  it("does not leak Acme subscription data when listing Beta", () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "enterprise");
    store.createSubscription(BETA_ORG, "starter");

    const betaSubscriptions = store.listSubscriptions(BETA_ORG);
    expect(betaSubscriptions).toHaveLength(1);
    expect(betaSubscriptions[0]?.plan).toBe("starter");
    expect(betaSubscriptions.every((subscription) => subscription.tenantId === BETA_ORG)).toBe(
      true,
    );
  });

  it("evaluates flag overrides per tenant", () => {
    const features = new InMemoryFeatures(
      new Map([
        [
          DEFAULT_ORG,
          {
            subscriptionStatus: "active",
            flagOverrides: [
              { featureName: "pack.spreadsheetImport", direction: "force_on" },
            ],
          },
        ],
        [
          BETA_ORG,
          {
            subscriptionStatus: "active",
            flagOverrides: [],
          },
        ],
      ]),
    );

    expect(features.isEnabled(DEFAULT_ORG, "pack.spreadsheetImport")).toBe(true);
    expect(features.isEnabled(BETA_ORG, "pack.spreadsheetImport")).toBe(false);
  });

  it("keeps core flags enabled per tenant when subscription is active", () => {
    const features = new InMemoryFeatures(
      new Map([
        [DEFAULT_ORG, { subscriptionStatus: "active", flagOverrides: [] }],
        [BETA_ORG, { subscriptionStatus: "canceled", flagOverrides: [] }],
      ]),
    );

    expect(features.isEnabled(DEFAULT_ORG, "catalog")).toBe(true);
    expect(features.isEnabled(BETA_ORG, "catalog")).toBe(false);
  });
});
