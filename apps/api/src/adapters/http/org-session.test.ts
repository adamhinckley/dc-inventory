import { MissingOrganizationContextError } from "@dc-inventory/shared-kernel";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { InMemoryDatabase } from "../in-memory-database.js";
import {
  staffOrganizationId,
  wholesaleOrganizationId,
} from "./org-session.js";

const apps: Array<Awaited<ReturnType<typeof buildApp>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("org-session fail closed (ADA-194)", () => {
  it("staffOrganizationId throws when staffAuth is missing", () => {
    expect(() => staffOrganizationId({})).toThrow(MissingOrganizationContextError);
  });

  it("wholesaleOrganizationId throws when wholesaleAuth is missing", () => {
    expect(() => wholesaleOrganizationId({})).toThrow(MissingOrganizationContextError);
  });

  it("returns 500 when a route uses staffOrganizationId without the audience guard", async () => {
    const app = await buildApp({ logger: false, database: new InMemoryDatabase() });
    apps.push(app);

    app.get("/internal/_test/missing-principal", async (request) => {
      return { organizationId: staffOrganizationId(request) };
    });

    const response = await app.inject({
      method: "GET",
      url: "/internal/_test/missing-principal",
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain("Missing organization context");
  });
});
