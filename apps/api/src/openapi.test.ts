import { describe, expect, it } from "vitest";
import { exportOpenApiYaml } from "./export-openapi.js";

describe("OpenAPI stub export", () => {
  it("emits three audience specs with the required stub operations", async () => {
    const specs = await exportOpenApiYaml();

    expect(specs.internal).toContain("/internal/products");
    expect(specs.internal).toContain("/internal/auth/login");
    expect(specs.internal).toContain("/internal/customers");
    expect(specs.internal).toContain("listInternalCustomers");
    expect(specs.internal).toContain("x-table");
    expect(specs.internal).toContain("listInternalProducts");
    expect(specs.internal).not.toContain("/ops/auth/");

    expect(specs.wholesale).toContain("/wholesale/catalog");
    expect(specs.wholesale).toContain("/wholesale/auth/login");
    expect(specs.wholesale).toContain("listWholesaleCatalog");
    expect(specs.wholesale).not.toContain("x-table");
    expect(specs.wholesale).not.toContain("/internal/");

    expect(specs.ops).toContain("/ops/subscription");
    expect(specs.ops).toContain("/ops/auth/login");
    expect(specs.ops).toContain("loginOps");
    expect(specs.ops).not.toContain("/internal/");
    expect(specs.ops).not.toContain("x-table");
  });
});
