import { describe, expect, it } from "vitest";
import { CORE_FEATURE_NAMES, evaluateFeature } from "../src/domain/features.js";

describe("evaluateFeature (G19)", () => {
  it("enables all six core names when subscription is trialing or active", () => {
    for (const status of ["trialing", "active"] as const) {
      for (const name of CORE_FEATURE_NAMES) {
        expect(evaluateFeature({ subscriptionStatus: status, flagOverrides: [] }, name)).toBe(
          true,
        );
      }
    }
  });

  it("disables all core names when subscription is past_due or canceled", () => {
    for (const status of ["past_due", "canceled"] as const) {
      for (const name of CORE_FEATURE_NAMES) {
        expect(evaluateFeature({ subscriptionStatus: status, flagOverrides: [] }, name)).toBe(
          false,
        );
      }
    }
  });

  it("lets force_off override an active subscription", () => {
    expect(
      evaluateFeature(
        {
          subscriptionStatus: "active",
          flagOverrides: [{ featureName: "inventory", direction: "force_off" }],
        },
        "inventory",
      ),
    ).toBe(false);
  });
});
