import { DEMO_SEED_TIME_LIMIT_MS } from "./demo-seed-config.js";

export class DemoSeedDeadlineError extends Error {
  override readonly name = "DemoSeedDeadlineError";

  constructor(elapsedMs: number) {
    super(
      `Demo seed exceeded the ${String(DEMO_SEED_TIME_LIMIT_MS / 60_000)} minute budget (${String(Math.ceil(elapsedMs / 1000))}s elapsed). Refusing to report success.`,
    );
  }
}

export type DemoSeedDeadline = {
  assertWithinBudget: () => void;
  elapsedMs: () => number;
};

export function startDemoSeedDeadline(startedAtMs: number = Date.now()): DemoSeedDeadline {
  return {
    elapsedMs: () => Date.now() - startedAtMs,
    assertWithinBudget: () => {
      const elapsed = Date.now() - startedAtMs;
      if (elapsed > DEMO_SEED_TIME_LIMIT_MS) {
        throw new DemoSeedDeadlineError(elapsed);
      }
    },
  };
}
