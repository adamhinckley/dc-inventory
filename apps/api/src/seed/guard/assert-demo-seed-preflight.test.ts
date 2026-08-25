import { describe, expect, it } from "vitest";
import { assertDemoSeedPreflight } from "./assert-demo-seed-preflight.js";
import {
  DEMO_EXCLUDED_SCHEMAS,
  DEMO_OWNED_SCHEMAS,
} from "./constants.js";
import { DemoSeedGuardError } from "./errors.js";
import { isDemoSeedResetOptIn } from "./parse-reset-opt-in.js";
import {
  InMemoryDemoBookOccupancy,
  InMemoryDemoBookReset,
} from "./in-memory-ports.js";

describe("isDemoSeedResetOptIn", () => {
  it("accepts only trimmed DEMO_SEED_RESET=1", () => {
    expect(isDemoSeedResetOptIn("1")).toBe(true);
    expect(isDemoSeedResetOptIn(" 1 ")).toBe(true);
    expect(isDemoSeedResetOptIn(undefined)).toBe(false);
    expect(isDemoSeedResetOptIn("")).toBe(false);
    expect(isDemoSeedResetOptIn("true")).toBe(false);
    expect(isDemoSeedResetOptIn("yes")).toBe(false);
    expect(isDemoSeedResetOptIn("01")).toBe(false);
  });
});

describe("assertDemoSeedPreflight", () => {
  const databaseUrl = "postgres://postgres:postgres@localhost:5432/dc_inventory";

  function ports() {
    const occupancy = new InMemoryDemoBookOccupancy();
    const reset = new InMemoryDemoBookReset(occupancy);
    return { occupancy, reset };
  }

  it("allows an empty local database without reset opt-in", async () => {
    const { occupancy, reset } = ports();
    await expect(
      assertDemoSeedPreflight({
        databaseUrl,
        resetOptIn: undefined,
        occupancy,
        reset,
      }),
    ).resolves.toBeUndefined();
  });

  it("refuses occupied databases unless reset is opted in", async () => {
    const { occupancy, reset } = ports();
    occupancy.seedOccupied("catalog.products");

    await expect(
      assertDemoSeedPreflight({
        databaseUrl,
        resetOptIn: undefined,
        occupancy,
        reset,
      }),
    ).rejects.toThrow(DemoSeedGuardError);
    await expect(
      assertDemoSeedPreflight({
        databaseUrl,
        resetOptIn: "true",
        occupancy,
        reset,
      }),
    ).rejects.toThrow(/must be exactly 1/);
  });

  it("truncates demo-owned schemas when DEMO_SEED_RESET=1", async () => {
    const { occupancy, reset } = ports();
    occupancy.seedOccupied("sales.orders");

    await assertDemoSeedPreflight({
      databaseUrl,
      resetOptIn: "1",
      occupancy,
      reset,
    });

    await expect(occupancy.checkOccupancy()).resolves.toEqual({ occupied: false });
  });

  it("fails remote hosts before checking occupancy", async () => {
    const { occupancy, reset } = ports();
    occupancy.seedOccupied("catalog.products");

    await expect(
      assertDemoSeedPreflight({
        databaseUrl: "postgres://postgres:postgres@neon.tech/demo",
        resetOptIn: "1",
        occupancy,
        reset,
      }),
    ).rejects.toThrow(/not allowed/);
    await expect(occupancy.checkOccupancy()).resolves.toEqual({
      occupied: true,
      location: "catalog.products",
    });
  });

  it("documents the eight demo-owned schemas and excluded licensing/operator schemas", () => {
    expect(DEMO_OWNED_SCHEMAS).toEqual([
      "catalog",
      "purchasing",
      "inventory",
      "identity",
      "customers",
      "sales",
      "tax",
      "accounting",
    ]);
    expect(DEMO_EXCLUDED_SCHEMAS).toEqual(["licensing", "operator_bridge"]);
    expect(DEMO_OWNED_SCHEMAS).not.toContain("licensing");
    expect(DEMO_OWNED_SCHEMAS).not.toContain("operator_bridge");
  });
});
