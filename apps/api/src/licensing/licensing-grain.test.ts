import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryFeatures, InMemoryLicensingStore } from "@dc-inventory/licensing";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("licensing tenant grain (ADA-166)", () => {
  it("rejects duplicate provider_ref within the same tenant", () => {
    const store = new InMemoryLicensingStore();
    const subscription = store.createSubscription(DEFAULT_ORG, "core");
    store.recordPayment(DEFAULT_ORG, subscription.id, "pi_shared_ref");
    expect(() =>
      store.recordPayment(DEFAULT_ORG, subscription.id, "pi_shared_ref"),
    ).toThrow(/duplicate software payment provider_ref/);
  });

  it("allows the same provider_ref across different tenants", async () => {
    const store = new InMemoryLicensingStore();
    const acmeSubscription = store.createSubscription(DEFAULT_ORG, "core");
    const betaSubscription = store.createSubscription(BETA_ORG, "core");

    store.recordPayment(DEFAULT_ORG, acmeSubscription.id, "pi_shared_ref");
    store.recordPayment(BETA_ORG, betaSubscription.id, "pi_shared_ref");

    expect(await store.listSubscriptions(DEFAULT_ORG)).toEqual([acmeSubscription]);
    expect(await store.listSubscriptions(BETA_ORG)).toEqual([betaSubscription]);
    expect(await store.listPayments(DEFAULT_ORG)).toHaveLength(1);
    expect(await store.listPayments(BETA_ORG)).toHaveLength(1);
    expect(await store.findPaymentByProviderRef(DEFAULT_ORG, "pi_shared_ref")).toBeDefined();
    expect(await store.findPaymentByProviderRef(BETA_ORG, "pi_shared_ref")).toBeDefined();
    expect((await store.listPayments(DEFAULT_ORG))[0]?.tenantId).toBe(DEFAULT_ORG);
    expect((await store.listPayments(BETA_ORG))[0]?.tenantId).toBe(BETA_ORG);
  });

  it("does not leak Acme subscription data when listing Beta", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "enterprise");
    store.createSubscription(BETA_ORG, "starter");

    const betaSubscriptions = await store.listSubscriptions(BETA_ORG);
    expect(betaSubscriptions).toHaveLength(1);
    expect(betaSubscriptions[0]?.plan).toBe("starter");
    expect(betaSubscriptions.every((subscription) => subscription.tenantId === BETA_ORG)).toBe(
      true,
    );
  });

  it("evaluates flag overrides per tenant", async () => {
    const features = new InMemoryFeatures(
      new Map([
        [
          DEFAULT_ORG,
          {
            subscriptionStatus: "active",
            flagOverrides: [{ featureName: "catalog", direction: "force_on" }],
          },
        ],
        [
          BETA_ORG,
          {
            subscriptionStatus: "active",
            flagOverrides: [{ featureName: "catalog", direction: "force_off" }],
          },
        ],
      ]),
    );

    await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(true);
    await expect(features.isEnabled(BETA_ORG, "catalog")).resolves.toBe(false);
  });

  it("keeps core flags enabled per tenant when subscription is active", async () => {
    const features = new InMemoryFeatures(
      new Map([
        [DEFAULT_ORG, { subscriptionStatus: "active", flagOverrides: [] }],
        [BETA_ORG, { subscriptionStatus: "canceled", flagOverrides: [] }],
      ]),
    );

    await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(true);
    await expect(features.isEnabled(BETA_ORG, "catalog")).resolves.toBe(false);
  });

  it("disables core flags when subscription is past_due", async () => {
    const features = new InMemoryFeatures(
      new Map([[DEFAULT_ORG, { subscriptionStatus: "past_due", flagOverrides: [] }]]),
    );

    await expect(features.isEnabled(DEFAULT_ORG, "inventory")).resolves.toBe(false);
    await expect(features.isEnabled(DEFAULT_ORG, "sales")).resolves.toBe(false);
  });
});
