import { existsSync, readFileSync } from "node:fs";
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
    expect(existsSync(join(srcRoot, "components/purchasing-orders-explorer.tsx"))).toBe(true);
  });

  it("gates the dashboard and puts account actions in the nav footer", () => {
    const dashboardFrame = readFileSync(
      join(srcRoot, "components/dashboard-frame.tsx"),
      "utf8",
    );
    expect(dashboardFrame).toMatch(/StaffSessionGate/);
    expect(dashboardFrame).toMatch(/AccountNavMenu/);
    expect(dashboardFrame).toMatch(/NavFooter/);
    expect(dashboardFrame).not.toMatch(/href="\/login"/);

    const signInGate = readFileSync(
      join(srcRoot, "components/staff-sign-in-dialog.tsx"),
      "utf8",
    );
    expect(signInGate).toMatch(/useGetInternalSession/);
    expect(signInGate).toMatch(/StaffSignInForm/);
    expect(signInGate).toMatch(/auth-sign-in-dialog/);

    const accountMenu = readFileSync(
      join(srcRoot, "components/account-nav-menu.tsx"),
      "utf8",
    );
    expect(accountMenu).toMatch(/useLogoutInternal/);
    expect(accountMenu).toMatch(/onSettled/);
    expect(accountMenu).toMatch(/router\.push\("\/login"\)/);
  });
});
