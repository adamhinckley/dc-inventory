import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import {
  CORE_FEATURE_NAMES,
  featuresAllCoreOn,
  InMemoryFeatures,
} from "./features.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

describe("InMemoryFeatures (core on)", () => {
  it("enables every core flag for any tenant", () => {
    const features = featuresAllCoreOn();
    for (const name of CORE_FEATURE_NAMES) {
      expect(features.isEnabled(DEFAULT_ORG, name)).toBe(true);
      expect(features.isEnabled(BETA_ORG, name)).toBe(true);
    }
  });

  it("disables unknown names", () => {
    expect(
      featuresAllCoreOn().isEnabled(DEFAULT_ORG, "pack.spreadsheetImport"),
    ).toBe(false);
  });
});

describe("InMemoryFeatures (tenant overrides)", () => {
  it("force_off wins over force_on for the same tenant", () => {
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

    expect(features.isEnabled(DEFAULT_ORG, "catalog")).toBe(false);
  });
});
