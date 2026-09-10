import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dashboardNav } from "./dashboard-routes";

const srcRoot = join(import.meta.dirname, "..");

describe("internal dashboard shell", () => {
  const navPagePath = (href: string) => {
    if (href === "/procurement") {
      return "procurement/(hub)/page.tsx";
    }
    return `${href.slice(1)}/page.tsx`;
  };

  it("declares the staff placeholder routes", () => {
    for (const item of dashboardNav) {
      const page = join(srcRoot, "app/(dashboard)", navPagePath(item.href));
      expect(existsSync(page), page).toBe(true);
    }

    expect(existsSync(join(srcRoot, "app/(auth)/login/page.tsx"))).toBe(true);
  });

  it("includes procurement sub-routes and workspace components", () => {
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/(hub)/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/(hub)/pre-order/[factoryId]/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/(hub)/purchase-orders/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/purchase-orders/new/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/purchase-orders/[id]/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/(hub)/suppliers/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/(hub)/suppliers/[id]/page.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchasing-2-workspace.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchasing-2-heading.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchase-orders-table.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchase-order-workspace.tsx"))).toBe(true);
    expect(
      existsSync(join(srcRoot, "components/purchase-order-draft-workspace.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "components/purchase-order-factory-send-workspace.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcRoot, "lib/purchase-order-line-math.ts"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/product-case-qty-dialog.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/purchasing-orders-explorer.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-inbound-explorer.tsx"))).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-inbound-table.tsx"))).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/receiving/[id]/page.tsx")),
    ).toBe(true);
    expect(
      existsSync(join(srcRoot, "app/(dashboard)/procurement/receiving/[id]/history/page.tsx")),
    ).toBe(true);
    expect(existsSync(join(srcRoot, "components/receiving-document-workspace.tsx"))).toBe(
      true,
    );
  });
});
