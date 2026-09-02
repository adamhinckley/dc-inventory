import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dashboardNav } from "./dashboard-routes";

const srcRoot = join(import.meta.dirname, "..");

describe("internal dashboard shell", () => {
  it("declares the staff placeholder routes", () => {
    for (const item of dashboardNav) {
      const page = join(srcRoot, "app/(dashboard)", item.href.slice(1), "page.tsx");
      expect(existsSync(page), page).toBe(true);
    }

    expect(existsSync(join(srcRoot, "app/(auth)/login/page.tsx"))).toBe(true);
  });

  it("includes purchasing sub-routes and workspace components", () => {
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/purchasing/completed/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/purchasing/suppliers/page.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchase-orders-table.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchase-order-workspace.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/product-case-qty-dialog.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchasing-orders-explorer.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-inbound-explorer.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-inbound-table.tsx"))).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/receiving/[id]/page.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-document-workspace.tsx"))).toBe(
      true,
    );
  });
});
