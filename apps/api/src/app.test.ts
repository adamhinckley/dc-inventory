import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  healthResponseSchema,
  notReadyResponseSchema,
  readyResponseSchema,
} from "./adapters/http/health.js";
import { pingResponseSchema } from "./adapters/http/ping.js";
import { InMemoryClock } from "./adapters/in-memory-clock.js";
import { InMemoryDatabase } from "./adapters/in-memory-database.js";
import { buildApp } from "./app.js";
import { MissingDatabaseUrlError } from "./infrastructure/database-url.js";
import { REQUEST_ID_HEADER } from "./infrastructure/request-id.js";
import { pinoLoggerOptions } from "./infrastructure/logging.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startApp(
  options?: Parameters<typeof buildApp>[0],
): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const app = await buildApp({
    logger: false,
    database: new InMemoryDatabase(),
    ...options,
  });
  apps.push(app);
  return app;
}

describe("composition root HTTP", () => {
  it("GET /health returns 200 without touching extras", async () => {
    const app = await startApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ ok: true });
    expect(healthResponseSchema.parse(body)).toEqual(body);
  });

  it("GET /ready returns 200 when the database pings", async () => {
    const app = await startApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ ready: true });
    expect(readyResponseSchema.parse(body)).toEqual(body);
  });

  it("GET /ready returns 503 when the database ping fails", async () => {
    const app = await startApp({
      database: new InMemoryDatabase({
        failWith: new Error("connection refused"),
      }),
    });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body).toEqual({
      ready: false,
      error: "connection refused",
    });
    expect(notReadyResponseSchema.parse(body)).toEqual(body);
  });

  it("GET /ready reports a missing DATABASE_URL clearly", async () => {
    const app = await startApp({
      database: new InMemoryDatabase({
        failWith: new MissingDatabaseUrlError(),
      }),
    });
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(503);
    const body = res.json() as { ready: boolean; error: string };
    expect(body.ready).toBe(false);
    expect(body.error).toMatch(/DATABASE_URL is missing/);
  });

  it("buildApp fails clearly without DATABASE_URL or a database override", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(buildApp({ logger: false })).rejects.toThrow(
        /DATABASE_URL is missing/,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previous;
      }
    }
  });

  it("GET /ping maps the use case through the HTTP adapter", async () => {
    const at = new Date("2026-08-22T04:00:00.000Z");
    const app = await startApp({ clock: new InMemoryClock(at) });
    const res = await app.inject({ method: "GET", url: "/ping" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({ ok: true, at: "2026-08-22T04:00:00.000Z" });
    expect(pingResponseSchema.parse(body)).toEqual(body);
  });

  it("echoes x-request-id and generates one when missing", async () => {
    const app = await startApp();
    const echoed = await app.inject({
      method: "GET",
      url: "/health",
      headers: { [REQUEST_ID_HEADER]: "req-from-client" },
    });
    expect(echoed.headers[REQUEST_ID_HEADER]).toBe("req-from-client");

    const generated = await app.inject({ method: "GET", url: "/health" });
    expect(generated.headers[REQUEST_ID_HEADER]).toEqual(expect.any(String));
    expect(String(generated.headers[REQUEST_ID_HEADER]).length).toBeGreaterThan(
      0,
    );
  });

  it("keeps audience mounts at /internal, /wholesale, and /ops", async () => {
    const app = await startApp();
    const internal = await app.inject({
      method: "GET",
      url: "/internal/products",
    });
    const wholesale = await app.inject({
      method: "GET",
      url: "/wholesale/catalog",
    });
    const ops = await app.inject({ method: "GET", url: "/ops/subscription" });
    expect(internal.statusCode).toBe(401);
    expect(wholesale.statusCode).toBe(401);
    expect(ops.statusCode).toBe(401);
  });

  it("writes JSON logs that include requestId", async () => {
    const lines: unknown[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        const text = chunk.toString().trim();
        if (text.length > 0) {
          lines.push(JSON.parse(text) as unknown);
        }
        callback();
      },
    });
    const app = await buildApp({
      logger: { ...pinoLoggerOptions("info"), stream },
      database: new InMemoryDatabase(),
    });
    apps.push(app);

    await app.inject({
      method: "GET",
      url: "/health",
      headers: { [REQUEST_ID_HEADER]: "log-req-1" },
    });

    expect(lines.length).toBeGreaterThan(0);
    expect(
      lines.some(
        (line) =>
          typeof line === "object" &&
          line !== null &&
          "requestId" in line &&
          (line as { requestId: unknown }).requestId === "log-req-1",
      ),
    ).toBe(true);
  });
});
