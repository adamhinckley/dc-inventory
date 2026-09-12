export type DashboardAudience = "staff" | "platform";

export function dashboardHomePath(
  audience: DashboardAudience,
): "/organizations" | "/catalog" {
  return audience === "platform" ? "/organizations" : "/catalog";
}

export function isPlatformDashboardPath(pathname: string): boolean {
  return pathname === "/organizations" || pathname.startsWith("/organizations/");
}

/** Platform belongs on Companies; `/` is not a destination for either audience. */
export function shouldRedirectDashboardHome(
  audience: DashboardAudience,
  pathname: string,
): boolean {
  if (pathname === "/") {
    return true;
  }
  return audience === "platform" && !isPlatformDashboardPath(pathname);
}
