import { describe, expect, it } from "vitest";
import { deriveOrganizationSlugFromDisplayName } from "./organization-slug.js";

describe("deriveOrganizationSlugFromDisplayName (internal UI copy)", () => {
  it("derives slug progressively while typing a company display name", () => {
    const fullName = "Harbor Wholesale";
    const slugs: string[] = [];

    for (let index = 1; index <= fullName.length; index += 1) {
      slugs.push(deriveOrganizationSlugFromDisplayName(fullName.slice(0, index)));
    }

    expect(slugs[0]).toBe("h");
    expect(slugs.at(-1)).toBe("harbor-wholesale");
    expect(slugs.at(-1)).not.toBe(slugs[0]);
  });

  it("does not leave a trailing hyphen when truncating", () => {
    const name = `${"a".repeat(47)}-extra`;
    const slug = deriveOrganizationSlugFromDisplayName(name);
    expect(slug).not.toMatch(/-$/);
    expect(slug.length).toBeLessThanOrEqual(48);
  });
});
