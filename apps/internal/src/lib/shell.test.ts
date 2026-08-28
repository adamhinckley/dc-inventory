import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dashboardNav } from "./dashboard-routes";

const srcRoot = join(import.meta.dirname, "..");

describe("internal dashboard shell", () => {
  it("declares the staff placeholder routes", () => {
    const hrefs = dashboardNav.map((item) => item.href);
    expect(hrefs).toEqual([
      "/catalog",
      "/customers",
      "/purchasing",
      "/inventory",
      "/sales",
      "/accounting",
      "/reports",
    ]);

    for (const href of hrefs) {
      const page = join(srcRoot, "app/(dashboard)", href.slice(1), "page.tsx");
      expect(existsSync(page), page).toBe(true);
    }

    expect(existsSync(join(srcRoot, "app/(auth)/login/page.tsx"))).toBe(true);
  });

  it("puts DataTable on catalog and purchasing supplier routes", () => {
    const catalogPage = readFileSync(
      join(srcRoot, "app/(dashboard)/catalog/page.tsx"),
      "utf8",
    );
    expect(catalogPage).toMatch(/searchParams/);
    expect(catalogPage).toMatch(/listParamsFromSearchParams/);

    const catalog = readFileSync(
      join(srcRoot, "components/catalog-table.tsx"),
      "utf8",
    );
    expect(catalog).toMatch(/DataTable\.Root/);
    expect(catalog).toMatch(/useListInternalProducts/);
    expect(catalog).toMatch(/replaceTableUrlParams/);

    const suppliers = readFileSync(
      join(srcRoot, "components/suppliers-table.tsx"),
      "utf8",
    );
    expect(suppliers).toMatch(/DataTable\.Root/);
    expect(suppliers).toMatch(/useListInternalSuppliers/);

    const placeholders = [
      "customers",
      "inventory",
      "sales",
      "accounting",
      "reports",
    ];
    for (const route of placeholders) {
      const text = readFileSync(
        join(srcRoot, "app/(dashboard)", route, "page.tsx"),
        "utf8",
      );
      expect(text, route).not.toMatch(/@dc-inventory\/ui-internal/);
      expect(text, route).not.toMatch(/import\s*\{[^}]*\bDataTable\b/);
      expect(text, route).toMatch(/DashboardPlaceholder/);
    }

    const purchasingPage = readFileSync(
      join(srcRoot, "app/(dashboard)/purchasing/page.tsx"),
      "utf8",
    );
    expect(purchasingPage).toMatch(/searchParams/);
    expect(purchasingPage).toMatch(/listParamsFromSearchParams/);

    const draftPurchaseOrders = readFileSync(
      join(srcRoot, "components/draft-purchase-orders-table.tsx"),
      "utf8",
    );
    expect(draftPurchaseOrders).toMatch(/DataTable\.Root/);
    expect(draftPurchaseOrders).toMatch(/useListInternalPurchaseOrders/);

    expect(
      existsSync(join(srcRoot, "app/(dashboard)/purchasing/suppliers/page.tsx")),
    ).toBe(true);
  });
});
