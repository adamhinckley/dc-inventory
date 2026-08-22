import { describe, expect, it } from "vitest";
import { CORE_FEATURE_NAMES, featuresAllCoreOn } from "./features.js";

describe("InMemoryFeatures (core on)", () => {
  it("enables every core flag", () => {
    const features = featuresAllCoreOn();
    for (const name of CORE_FEATURE_NAMES) {
      expect(features.isEnabled(name)).toBe(true);
    }
  });

  it("disables unknown names", () => {
    expect(featuresAllCoreOn().isEnabled("pack.spreadsheetImport")).toBe(false);
  });
});
