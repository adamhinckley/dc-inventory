import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it, vi } from "vitest";
import { buildProductImageObjectKey } from "../src/domain/product-image-object-key.js";

const ACME_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");
const FIXED_SUFFIX = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

describe("buildProductImageObjectKey", () => {
  it("prefixes keys with the organization id including DEFAULT", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_SUFFIX);

    expect(buildProductImageObjectKey(ACME_ORG)).toBe(
      `DEFAULT/images/${FIXED_SUFFIX}`,
    );

    vi.restoreAllMocks();
  });

  it("uses different prefixes for Acme and Beta so keys are not guessable across orgs", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(FIXED_SUFFIX);

    const acmeKey = buildProductImageObjectKey(ACME_ORG);
    const betaKey = buildProductImageObjectKey(BETA_ORG);

    expect(acmeKey.startsWith("DEFAULT/")).toBe(true);
    expect(betaKey.startsWith(`${BETA_ORG}/`)).toBe(true);
    expect(acmeKey).not.toBe(betaKey);
    expect(acmeKey.startsWith(`${BETA_ORG}/`)).toBe(false);
    expect(betaKey.startsWith("DEFAULT/")).toBe(false);

    vi.restoreAllMocks();
  });

  it("does not embed the upload filename in the object key", () => {
    const uploadFilename = "vacation-photo.jpg";

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const key = buildProductImageObjectKey(ACME_ORG);
      expect(key).not.toContain(uploadFilename);
      expect(key).not.toContain("vacation-photo");
      expect(key).not.toMatch(/\.jpg$/);
    }
  });

  it("generates unique keys for repeated calls within one org", () => {
    const keys = new Set(
      Array.from({ length: 10 }, () => buildProductImageObjectKey(BETA_ORG)),
    );

    expect(keys.size).toBe(10);
    for (const key of keys) {
      expect(key.startsWith(`${BETA_ORG}/images/`)).toBe(true);
    }
  });
});
