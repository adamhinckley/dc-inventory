import { describe, expect, it } from "vitest";
import { canManageMasterData } from "./staff-master-data-manage";

describe("canManageMasterData", () => {
  it("allows admin and purchasing only", () => {
    expect(canManageMasterData(["admin"])).toBe(true);
    expect(canManageMasterData(["purchasing"])).toBe(true);
    expect(canManageMasterData(["warehouse"])).toBe(false);
    expect(canManageMasterData(["sales_support"])).toBe(false);
    expect(canManageMasterData(["accounting"])).toBe(false);
    expect(canManageMasterData([])).toBe(false);
  });
});
