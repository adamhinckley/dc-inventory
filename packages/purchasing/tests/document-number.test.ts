import { describe, expect, it } from "vitest";
import {
  collectOccupiedDocumentPrefixes,
  fallbackDocumentPoPrefix,
  pickUniqueFallbackDocumentPoPrefix,
  resolveDocumentPoPrefix,
} from "../src/domain/document-number.js";

describe("document-number fallback prefixes", () => {
  it("derives a stable fallback prefix from the supplier id", () => {
    expect(
      fallbackDocumentPoPrefix("cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
    ).toBe("SDUI");
  });

  it("avoids fallback collisions with configured prefixes and other suppliers", () => {
    const suppliers = [
      { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", poPrefix: "8JFC" },
      { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", poPrefix: null },
      { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", poPrefix: null },
    ];

    const occupiedForSecond = collectOccupiedDocumentPrefixes(suppliers, suppliers[1]!.id);
    const secondPrefix = resolveDocumentPoPrefix(null, suppliers[1]!.id, occupiedForSecond);
    const occupiedForThird = collectOccupiedDocumentPrefixes(suppliers, suppliers[2]!.id);
    const thirdPrefix = resolveDocumentPoPrefix(null, suppliers[2]!.id, occupiedForThird);

    expect(secondPrefix).not.toBe("8JFC");
    expect(thirdPrefix).not.toBe("8JFC");
    expect(secondPrefix).not.toBe(thirdPrefix);
  });

  it("advances the fallback attempt when the first candidate is occupied", () => {
    const occupied = new Set([fallbackDocumentPoPrefix("supplier-a")]);
    expect(pickUniqueFallbackDocumentPoPrefix("supplier-a", occupied)).not.toBe(
      fallbackDocumentPoPrefix("supplier-a", 0),
    );
  });
});
