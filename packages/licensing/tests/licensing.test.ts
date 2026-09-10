import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import {
  InMemoryFeatures,
  InMemoryLicensingStore,
  LicensingFeatures,
  ListLicensingPaymentsUseCase,
  ListLicensingSubscriptionsUseCase,
  runWithLicensingFeatureStateCacheAsync,
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
      new ListLicensingSubscriptionsUseCase(store).execute({
        organizationId: DEFAULT_ORG,
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({ items: [{ plan: "core", status: "active" }], total: 1 });
    await expect(
      new ListLicensingPaymentsUseCase(store).execute({
        organizationId: DEFAULT_ORG,
        page: 1,
        pageSize: 25,
      }),
    ).resolves.toMatchObject({
      items: [{ providerRef: "manual-1", amountCents: 1250, status: "succeeded" }],
      total: 1,
    });
  });

  it("pages software payment history", async () => {
    const store = new InMemoryLicensingStore();
    const subscription = store.createSubscription(DEFAULT_ORG, "core");
    for (let index = 0; index < 3; index += 1) {
      store.recordPayment(DEFAULT_ORG, subscription.id, `manual-${index}`, 1000 + index);
    }

    const pageOne = await new ListLicensingPaymentsUseCase(store).execute({
      organizationId: DEFAULT_ORG,
      page: 1,
      pageSize: 2,
    });
    const pageTwo = await new ListLicensingPaymentsUseCase(store).execute({
      organizationId: DEFAULT_ORG,
      page: 2,
      pageSize: 2,
    });
    expect(pageOne).toMatchObject({ page: 1, pageSize: 2, total: 3 });
    expect(pageOne.items).toHaveLength(2);
    expect(pageTwo.items).toHaveLength(1);
    expect(pageTwo.total).toBe(3);
    expect(
      new Set(
        [...pageOne.items, ...pageTwo.items].map((payment) => payment.providerRef),
      ),
    ).toEqual(new Set(["manual-0", "manual-1", "manual-2"]));
  });

  it("reads the latest subscription without scanning full history", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "starter", "canceled");
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.createSubscription(DEFAULT_ORG, "core", "active");

    await expect(store.getLatestSubscription(DEFAULT_ORG)).resolves.toMatchObject({
      plan: "core",
      status: "active",
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

  it("caches tenant feature state for repeated isEnabled calls in one request scope", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "core", "active");
    const getFeatureState = vi.spyOn(store, "getFeatureState");
    const features = new LicensingFeatures(store);

    await runWithLicensingFeatureStateCacheAsync(async () => {
      await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(true);
      await expect(features.isEnabled(DEFAULT_ORG, "sales")).resolves.toBe(true);
      expect(getFeatureState).toHaveBeenCalledTimes(1);
    });

    await runWithLicensingFeatureStateCacheAsync(async () => {
      await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(true);
      expect(getFeatureState).toHaveBeenCalledTimes(2);
    });
  });

  it("does not share feature-state cache across concurrent request scopes", async () => {
    const store = new InMemoryLicensingStore();
    store.createSubscription(DEFAULT_ORG, "core", "active");
    const getFeatureState = vi.spyOn(store, "getFeatureState").mockImplementation(
      async (organizationId) =>
        InMemoryLicensingStore.prototype.getFeatureState.call(store, organizationId),
    );
    const features = new LicensingFeatures(store);

    await Promise.all([
      runWithLicensingFeatureStateCacheAsync(async () => {
        await features.isEnabled(DEFAULT_ORG, "catalog");
        await features.isEnabled(DEFAULT_ORG, "sales");
      }),
      runWithLicensingFeatureStateCacheAsync(async () => {
        await features.isEnabled(DEFAULT_ORG, "inventory");
        await features.isEnabled(DEFAULT_ORG, "sales");
      }),
    ]);

    expect(getFeatureState).toHaveBeenCalledTimes(2);
  });

  it("retains the all-core-on adapter for isolated unit tests", async () => {
    const features = new InMemoryFeatures();

    await expect(features.isEnabled(DEFAULT_ORG, "customers")).resolves.toBe(true);
  });
});
