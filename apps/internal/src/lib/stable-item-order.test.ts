import { describe, expect, it } from "vitest";
import { mergeStableIds } from "./stable-item-order";

describe("mergeStableIds", () => {
  it("keeps the previous order when the same ids come back reordered", () => {
    expect(mergeStableIds(["main", "warehouse"], ["warehouse", "main"])).toEqual([
      "main",
      "warehouse",
    ]);
  });

  it("appends new ids and drops removed ones", () => {
    expect(mergeStableIds(["main", "gone"], ["dock", "main"])).toEqual(["main", "dock"]);
  });
});
