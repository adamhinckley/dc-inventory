import { beforeEach, describe, expect, it, vi } from "vitest";

let instanceCounter = 0;

vi.mock("@dc-inventory/accounting", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dc-inventory/accounting")>();
  return {
    ...actual,
    DrizzleInvoiceRepository: vi.fn().mockImplementation(() => {
      const instanceId = ++instanceCounter;
      return { instanceId };
    }),
  };
});

import type { AppDrizzle } from "../infrastructure/db.js";
import { PostgresAccountingUnitOfWork } from "./postgres-accounting-unit-of-work.js";

type MockRepo = { instanceId: number };

describe("PostgresAccountingUnitOfWork", () => {
  beforeEach(() => {
    instanceCounter = 0;
  });

  it("binds invoices to each concurrent run() on a shared singleton", async () => {
    const db = {
      transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({})),
    } as unknown as AppDrizzle;

    const uow = new PostgresAccountingUnitOfWork(db);
    const firstInside = createGate();
    const secondInside = createGate();
    const observed = {
      first: 0,
      second: 0,
      firstDuringOverlap: 0,
    };

    await Promise.all([
      uow.run(async () => {
        observed.first = (uow.invoices as MockRepo).instanceId;
        firstInside.open();
        await secondInside.wait();
        observed.firstDuringOverlap = (uow.invoices as MockRepo).instanceId;
      }),
      uow.run(async () => {
        await firstInside.wait();
        observed.second = (uow.invoices as MockRepo).instanceId;
        secondInside.open();
      }),
    ]);

    expect(observed.first).toBeGreaterThan(0);
    expect(observed.second).toBeGreaterThan(0);
    expect(observed.firstDuringOverlap).toBe(observed.first);
    expect(observed.second).not.toBe(observed.first);
  });
});

function createGate(): { wait: () => Promise<void>; open: () => void } {
  let opened = false;
  let resolve: (() => void) | undefined;
  return {
    wait: () =>
      opened
        ? Promise.resolve()
        : new Promise<void>((next) => {
            resolve = next;
          }),
    open: () => {
      opened = true;
      resolve?.();
    },
  };
}
