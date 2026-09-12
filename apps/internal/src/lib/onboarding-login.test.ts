import { describe, expect, it } from "vitest";
import {
  defaultStaffOrganizationSlug,
  loginPathWithOnboarding,
  onboardingPrefillFromSearchParams,
} from "./onboarding-login.js";

describe("onboarding login prefill", () => {
  it("reads organization and email from the invite URL", () => {
    const params = new URLSearchParams(
      "token=abc&organization=harbor-wholesale&email=owner%40harbor.test",
    );
    expect(onboardingPrefillFromSearchParams(params)).toEqual({
      organization: "harbor-wholesale",
      email: "owner@harbor.test",
    });
  });

  it("carries both fields onto /login after set-password", () => {
    expect(
      loginPathWithOnboarding({
        organization: "harbor-wholesale",
        email: "owner@harbor.test",
      }),
    ).toBe("/login?organization=harbor-wholesale&email=owner%40harbor.test");
  });

  it("keeps acme only when the invite did not name an organization", () => {
    expect(defaultStaffOrganizationSlug("")).toBe("acme");
    expect(defaultStaffOrganizationSlug("harbor-wholesale")).toBe("harbor-wholesale");
  });
});
