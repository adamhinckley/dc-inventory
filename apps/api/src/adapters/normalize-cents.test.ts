import { describe, expect, it } from "vitest";
import { normalizeCents } from "./normalize-cents.js";

describe("normalizeCents", () => {
  it("returns null for nullish values", () => {
    expect(normalizeCents(null)).toBeNull();
    expect(normalizeCents(undefined)).toBeNull();
  });

  it("passes numbers through unchanged", () => {
    expect(normalizeCents(357)).toBe(357);
  });

  it("coerces postgres.js bigint strings to numbers", () => {
    expect(normalizeCents("357")).toBe(357);
  });
});
