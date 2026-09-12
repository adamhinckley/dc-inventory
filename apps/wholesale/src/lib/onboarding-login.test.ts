import { describe, expect, it } from "vitest";
import {
  inviteDisplayNameFromSearchParams,
  loginPathWithOnboarding,
  onboardingPrefillFromSearchParams,
  firstNameFromDisplayName,
  setPasswordHeading,
} from "./onboarding-login.js";

describe("onboarding login prefill", () => {
  it("reads organization, email, and name from the invite URL", () => {
    const params = new URLSearchParams(
      "token=abc&organization=acme&email=buyer%40harbor.test&name=Harbor+Supply",
    );
    expect(onboardingPrefillFromSearchParams(params)).toEqual({
      organization: "acme",
      email: "buyer@harbor.test",
    });
    expect(inviteDisplayNameFromSearchParams(params)).toBe("Harbor Supply");
    expect(
      loginPathWithOnboarding({ organization: "acme", email: "buyer@harbor.test" }),
    ).toBe("/login?organization=acme&email=buyer%40harbor.test");
  });

  it("greets the invited person by first name", () => {
    expect(firstNameFromDisplayName("Adam Hinckley")).toBe("Adam");
    expect(setPasswordHeading("Adam Hinckley")).toBe("Hello Adam.");
    expect(setPasswordHeading("")).toBe("Let's set up your password.");
  });
});
