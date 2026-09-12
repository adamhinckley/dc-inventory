import { describe, expect, it } from "vitest";
import {
  deriveOrganizationSlugFromDisplayName,
  isOrganizationSlugValid,
} from "../src/domain/organization-slug.js";

describe("organization slug derivation", () => {
  it("derives lowercase hyphenated slugs from display names", () => {
    expect(deriveOrganizationSlugFromDisplayName("Harbor Wholesale")).toBe("harbor-wholesale");
    expect(deriveOrganizationSlugFromDisplayName("  Acme & Sons, LLC  ")).toBe("acme-sons-llc");
    expect(deriveOrganizationSlugFromDisplayName("O'Brien Foods")).toBe("obrien-foods");
  });

  it("truncates derived slugs to 48 characters", () => {
    const longName = "A".repeat(80);
    expect(deriveOrganizationSlugFromDisplayName(longName)).toHaveLength(48);
  });

  it("does not leave a trailing hyphen when truncating", () => {
    const name = `${"a".repeat(47)}-extra`;
    const slug = deriveOrganizationSlugFromDisplayName(name);
    expect(slug).not.toMatch(/-$/);
    expect(slug.length).toBeLessThanOrEqual(48);
  });

  it("validates slug pattern", () => {
    expect(isOrganizationSlugValid("harbor-wholesale")).toBe(true);
    expect(isOrganizationSlugValid("Bad Slug")).toBe(false);
    expect(isOrganizationSlugValid("")).toBe(false);
  });
});
