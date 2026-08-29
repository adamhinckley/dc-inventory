import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  CORE_FEATURE_NAMES,
  featuresAllCoreOn,
  InMemoryFeatures,
} from "@dc-inventory/licensing";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("InMemoryFeatures (core on)", () => {
  it("enables every core flag for any tenant", async () => {
    const features = featuresAllCoreOn();
    for (const name of CORE_FEATURE_NAMES) {
      await expect(features.isEnabled(DEFAULT_ORG, name)).resolves.toBe(true);
      await expect(features.isEnabled(BETA_ORG, name)).resolves.toBe(true);
    }
  });

});

describe("InMemoryFeatures (tenant overrides)", () => {
  it("force_off wins over force_on for the same tenant", async () => {
    const features = new InMemoryFeatures(
      new Map([
        [
          DEFAULT_ORG,
          {
            subscriptionStatus: "active",
            flagOverrides: [
              { featureName: "catalog", direction: "force_on" },
              { featureName: "catalog", direction: "force_off" },
            ],
          },
        ],
      ]),
    );

    await expect(features.isEnabled(DEFAULT_ORG, "catalog")).resolves.toBe(false);
  });
});
