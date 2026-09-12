import { describe, expect, it } from "vitest";
import {
  dashboardHomePath,
  isPlatformDashboardPath,
  shouldRedirectDashboardHome,
} from "./dashboard-home-path";

describe("dashboardHomePath", () => {
  it("sends platform users to companies, not catalog", () => {
    expect(dashboardHomePath("platform")).toBe("/organizations");
    expect(dashboardHomePath("staff")).toBe("/catalog");
  });
});

describe("shouldRedirectDashboardHome", () => {
  it("keeps platform off staff workspace routes", () => {
    expect(shouldRedirectDashboardHome("platform", "/catalog")).toBe(true);
    expect(shouldRedirectDashboardHome("platform", "/customers")).toBe(true);
    expect(shouldRedirectDashboardHome("platform", "/")).toBe(true);
    expect(shouldRedirectDashboardHome("platform", "/organizations")).toBe(false);
    expect(shouldRedirectDashboardHome("platform", "/organizations/new")).toBe(false);
  });

  it("only moves staff off the dashboard root", () => {
    expect(shouldRedirectDashboardHome("staff", "/")).toBe(true);
    expect(shouldRedirectDashboardHome("staff", "/catalog")).toBe(false);
    expect(shouldRedirectDashboardHome("staff", "/customers")).toBe(false);
  });
});

describe("isPlatformDashboardPath", () => {
  it("treats companies routes as the platform workspace", () => {
    expect(isPlatformDashboardPath("/organizations")).toBe(true);
    expect(isPlatformDashboardPath("/organizations/new")).toBe(true);
    expect(isPlatformDashboardPath("/catalog")).toBe(false);
    expect(isPlatformDashboardPath("/organization")).toBe(false);
  });
});
