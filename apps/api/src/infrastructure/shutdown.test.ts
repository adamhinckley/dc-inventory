import { afterEach, describe, expect, it } from "vitest";
import { InMemoryDatabase } from "../adapters/in-memory-database.js";
import { buildApp } from "../app.js";
import { DrainState } from "./drain-state.js";
import {
  DEFAULT_SHUTDOWN_TIMEOUT_MS,
  readShutdownTimeoutMs,
  shutdownApp,
} from "./shutdown.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("graceful API shutdown", () => {
  it.each(["SIGTERM", "SIGINT"] as const)(
    "%s stops readiness and closes Fastify and the database",
    async (signal) => {
      const database = new InMemoryDatabase();
      const drainState = new DrainState();
      const app = await buildApp({
        logger: false,
        database,
        drainState,
      });
      apps.push(app);

      await shutdownApp(app, drainState, signal, {
        forceCloseAfterMs: 50,
        timeoutMs: 100,
        exit: (code) => {
          throw new Error(`unexpected exit ${String(code)}`);
        },
      });

      expect(drainState.isDraining()).toBe(true);
      expect(database.closeCalls).toBe(1);
    },
  );

  it("uses a bounded default and rejects invalid timeout configuration", () => {
    expect(readShutdownTimeoutMs(undefined)).toBe(DEFAULT_SHUTDOWN_TIMEOUT_MS);
    expect(readShutdownTimeoutMs("2500")).toBe(2500);
    expect(() => readShutdownTimeoutMs("0")).toThrow(
      "SHUTDOWN_TIMEOUT_MS must be a positive integer",
    );
    expect(() => readShutdownTimeoutMs("not-a-number")).toThrow(
      "SHUTDOWN_TIMEOUT_MS must be a positive integer",
    );
  });
});
