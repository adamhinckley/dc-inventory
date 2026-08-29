import { describe, expect, it } from "vitest";
import { readFeaturesAllCoreOn } from "./features-all-core-on.js";

describe("readFeaturesAllCoreOn", () => {
  it("honors an explicit 1 or 0 after trim", () => {
    expect(readFeaturesAllCoreOn({ FEATURES_ALL_CORE_ON: "1" })).toBe(true);
    expect(readFeaturesAllCoreOn({ FEATURES_ALL_CORE_ON: " 1 " })).toBe(true);
    expect(readFeaturesAllCoreOn({ FEATURES_ALL_CORE_ON: "0" })).toBe(false);
    expect(readFeaturesAllCoreOn({ FEATURES_ALL_CORE_ON: " 0 " })).toBe(false);
  });

  it("defaults on for local listen, off for test and production", () => {
    expect(readFeaturesAllCoreOn({})).toBe(true);
    expect(readFeaturesAllCoreOn({ NODE_ENV: "development" })).toBe(true);
    expect(readFeaturesAllCoreOn({ NODE_ENV: "test" })).toBe(false);
    expect(readFeaturesAllCoreOn({ NODE_ENV: "production" })).toBe(false);
  });

  it("lets the explicit flag win over NODE_ENV", () => {
    expect(
      readFeaturesAllCoreOn({ NODE_ENV: "production", FEATURES_ALL_CORE_ON: "1" }),
    ).toBe(true);
    expect(
      readFeaturesAllCoreOn({ NODE_ENV: "development", FEATURES_ALL_CORE_ON: "0" }),
    ).toBe(false);
  });
});
