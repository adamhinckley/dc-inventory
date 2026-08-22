import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { InMemoryClock } from "./adapters/in-memory-clock.js";
import { buildApp } from "./app.js";
import { REQUEST_ID_HEADER } from "./infrastructure/request-id.js";
import { pinoLoggerOptions } from "./infrastructure/logging.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function startApp(
  options?: Parameters<typeof buildApp>[0],
): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const app = await buildApp({ logger: false, ...options });
  apps.push(app);
  return app;
}

describe("composition root HTTP", () => {
  it("GET /health returns 200 without touching extras", async () => {
    const app = await startApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("GET /ready is a stub 200", async () => {
    const app = await startApp();
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ready: true });
  });

  it("GET /ping maps the use case through the HTTP adapter", async () => {
    const at = new Date("2026-08-22T04:00:00.000Z");
    const app = await startApp({ clock: new InMemoryClock(at) });
    const res = await app.inject({ method: "GET", url: "/ping" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, at: "2026-08-22T04:00:00.000Z" });
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
    expect(internal.statusCode).toBe(200);
    expect(wholesale.statusCode).toBe(200);
    expect(ops.statusCode).toBe(200);
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
