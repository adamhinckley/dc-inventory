import { describe, expect, it } from "vitest";
import {
  findDraftCartLine,
  remainingDraftLines,
  toReplaceLines,
  parseCartQty,
  replaceDraftLineQty,
} from "./cart-line-qty";

describe("parseCartQty", () => {
  it("accepts whole numbers of 0 or more", () => {
    expect(parseCartQty("0")).toBe(0);
    expect(parseCartQty("1")).toBe(1);
    expect(parseCartQty("1500")).toBe(1500);
  });

  it("rejects empty and decimal strings", () => {
    expect(parseCartQty("")).toBeNull();
    expect(parseCartQty("1.5")).toBeNull();
  });
});

describe("replaceDraftLineQty", () => {
  const other = "11111111-1111-4111-8111-111111111111";
  const target = "22222222-2222-4222-8222-222222222222";

  it("sets qty on the matching product and keeps other lines", () => {
    expect(
      replaceDraftLineQty(
        [
          { productId: other, name: "Washer", qty: 2 },
          { productId: target, name: "Bolt", qty: 5 },
        ],
        target,
        9,
        "Bolt",
      ),
    ).toEqual([
      { productId: other, qty: 2 },
      { productId: target, qty: 9 },
    ]);
  });

  it("matches the target line by name when productId is missing", () => {
    expect(
      replaceDraftLineQty(
        [
          { productId: other, name: "Washer", qty: 2 },
          { name: "Bolt", qty: 5 },
        ],
        target,
        9,
        "Bolt",
      ),
    ).toEqual([
      { productId: other, qty: 2 },
      { productId: target, qty: 9 },
    ]);
  });

  it("omits the target line when qty is 0", () => {
    expect(
      replaceDraftLineQty(
        [
          { productId: other, name: "Washer", qty: 2 },
          { productId: target, name: "Bolt", qty: 5 },
        ],
        target,
        0,
        "Bolt",
      ),
    ).toEqual([{ productId: other, qty: 2 }]);
  });

  it("returns null when another line is missing productId", () => {
    expect(
      replaceDraftLineQty(
        [{ name: "Washer", qty: 2 }, { productId: target, name: "Bolt", qty: 1 }],
        target,
        3,
        "Bolt",
      ),
    ).toBeNull();
  });
});

describe("findDraftCartLine", () => {
  it("prefers productId and falls back to name", () => {
    const byId = findDraftCartLine(
      [{ productId: "p1", name: "Lantern", qty: 2 }],
      "p1",
      "Lantern",
    );
    expect(byId?.qty).toBe(2);

    const byName = findDraftCartLine(
      [{ name: "Lantern", qty: 8 }],
      "p1",
      "Lantern",
    );
    expect(byName?.qty).toBe(8);
  });
});

describe("remainingDraftLines", () => {
  it("drops the line by id", () => {
    expect(
      remainingDraftLines(
        [
          { id: "a", sku: "L1", name: "Lantern", qty: 2 },
          { id: "b", sku: "V1", name: "Vase", qty: 1 },
        ],
        "a",
      ),
    ).toEqual([{ id: "b", sku: "V1", name: "Vase", qty: 1 }]);
  });
});

describe("toReplaceLines", () => {
  it("uses productId when present and looks up the rest", async () => {
    const lookup = async (sku: string) => (sku === "V1" ? "id-vase" : null);
    await expect(
      toReplaceLines(
        [
          { productId: "id-lantern", sku: "L1", name: "Lantern", qty: 2 },
          { sku: "V1", name: "Vase", qty: 1 },
        ],
        lookup,
      ),
    ).resolves.toEqual([
      { productId: "id-lantern", qty: 2 },
      { productId: "id-vase", qty: 1 },
    ]);
  });

  it("returns null when a sku cannot be resolved", async () => {
    await expect(
      toReplaceLines([{ sku: "MISSING", name: "Ghost", qty: 1 }], async () => null),
    ).resolves.toBeNull();
  });
});
