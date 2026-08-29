import type { FastifyInstance } from "fastify";
import type { DrainState } from "./drain-state.js";

export const DEFAULT_FORCE_CLOSE_AFTER_MS = 10_000;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

export type ShutdownOptions = {
  forceCloseAfterMs?: number;
  timeoutMs?: number;
  exit?: (code: number) => void;
};

function positiveMilliseconds(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export async function shutdownApp(
  app: FastifyInstance,
  drainState: DrainState,
  signal: NodeJS.Signals,
  options: ShutdownOptions = {},
): Promise<void> {
  const timeoutMs = positiveMilliseconds(
    options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS,
    "shutdown timeout",
  );
  const forceCloseAfterMs = positiveMilliseconds(
    options.forceCloseAfterMs ??
      Math.min(DEFAULT_FORCE_CLOSE_AFTER_MS, Math.max(1, timeoutMs - 1)),
    "force-close timeout",
  );
  if (forceCloseAfterMs >= timeoutMs) {
    throw new Error("force-close timeout must be shorter than shutdown timeout");
  }

  const exit = options.exit ?? ((code: number) => process.exit(code));
  drainState.beginDrain();
  app.log.info({ signal, timeoutMs }, "API shutdown started");

  const forceTimer = setTimeout(() => {
    app.log.warn({ signal, forceCloseAfterMs }, "forcing open connections closed");
    app.server.closeAllConnections();
  }, forceCloseAfterMs);
  const hardTimer = setTimeout(() => {
    app.log.error({ signal, timeoutMs }, "API shutdown timed out");
    exit(1);
  }, timeoutMs);

  try {
    await app.close();
    app.log.info({ signal }, "API shutdown complete");
  } catch (error) {
    app.log.error({ err: error, signal }, "API shutdown failed");
    exit(1);
  } finally {
    clearTimeout(forceTimer);
    clearTimeout(hardTimer);
  }
}

export function registerShutdownSignals(
  app: FastifyInstance,
  drainState: DrainState,
  options: ShutdownOptions = {},
): () => void {
  let shutdown: Promise<void> | undefined;
  const handlers = new Map<NodeJS.Signals, () => void>();

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    const handler = () => {
      shutdown ??= shutdownApp(app, drainState, signal, options);
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      process.removeListener(signal, handler);
    }
  };
}

export function readShutdownTimeoutMs(
  value = process.env.SHUTDOWN_TIMEOUT_MS,
): number {
  if (value === undefined) {
    return DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }
  return positiveMilliseconds(Number(value), "SHUTDOWN_TIMEOUT_MS");
}
