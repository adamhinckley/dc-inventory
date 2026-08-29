import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  InMemoryFeatures,
  InMemoryLicensingStore,
  LicensingFeatures,
  ListLicensingPaymentsUseCase,
  ListLicensingSubscriptionsUseCase,
} from "../src/index.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("Licensing application ports", () => {
  it("lists in-memory subscription and software payment state per tenant", async () => {
    const store = new InMemoryLicensingStore();
    const subscription = store.createSubscription(DEFAULT_ORG, "core");
    store.createSubscription(BETA_ORG, "starter");
    store.recordPayment(DEFAULT_ORG, subscription.id, "manual-1", 1250);

    await expect(
      new ListLicensingSubscriptionsUseCase(store).execute({ organizationId: DEFAULT_ORG }),
    ).resolves.toMatchObject({ items: [{ plan: "core", status: "active" }] });
    await expect(
      new ListLicensingPaymentsUseCase(store).execute({ organizationId: DEFAULT_ORG }),
    ).resolves.toMatchObject({
      items: [{ providerRef: "manual-1", amountCents: 1250, status: "succeeded" }],
    });
  });

  it("evaluates features from the same repository state", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "core", "active");
    store.createSubscription(BETA_ORG, "core", "canceled");
    const pastDueOrg = OrganizationId.parse("770e8400-e29b-41d4-a716-446655440088");
    store.createSubscription(pastDueOrg, "core", "past_due");
    store.setFlagOverrides(DEFAULT_ORG, [
      { featureName: "catalog", direction: "force_on" },
      { featureName: "catalog", direction: "force_off" },
    ]);
    const features = new LicensingFeatures(store);

    await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(false);
    await expect(features.isEnabled(DEFAULT_ORG, "sales")).resolves.toBe(true);
    await expect(features.isEnabled(BETA_ORG, "sales")).resolves.toBe(false);
    await expect(features.isEnabled(pastDueOrg, "inventory")).resolves.toBe(false);
  });

  it("retains the all-core-on adapter for isolated unit tests", async () => {
    const features = new InMemoryFeatures();

    await expect(features.isEnabled(DEFAULT_ORG, "customers")).resolves.toBe(true);
  });
});
