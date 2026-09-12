import { describe, expect, it } from "vitest";
import {
  defaultStaffOrganizationSlug,
  inviteDisplayNameFromSearchParams,
  loginPathWithOnboarding,
  onboardingPrefillFromSearchParams,
  firstNameFromDisplayName,
  setPasswordHeading,
} from "./onboarding-login.js";

describe("onboarding login prefill", () => {
  it("reads organization and email from the invite URL", () => {
    const params = new URLSearchParams(
      "token=abc&organization=harbor-wholesale&email=owner%40harbor.test&name=Harbor+Owner",
    );
    expect(onboardingPrefillFromSearchParams(params)).toEqual({
      organization: "harbor-wholesale",
      email: "owner@harbor.test",
    });
    expect(inviteDisplayNameFromSearchParams(params)).toBe("Harbor Owner");
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

  it("greets the invited person by first name", () => {
    expect(firstNameFromDisplayName("Adam Hinckley")).toBe("Adam");
    expect(setPasswordHeading("Adam Hinckley")).toBe("Hello Adam.");
    expect(setPasswordHeading("")).toBe("Let's set up your password.");
  });
});
