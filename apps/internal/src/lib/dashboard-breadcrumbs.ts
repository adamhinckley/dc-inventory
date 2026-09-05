import { dashboardNav } from "./dashboard-routes";

export type DashboardBreadcrumbCrumb = {
  href: string;
  label: string;
  current: boolean;
};

const NAV_LABELS = Object.fromEntries(
  dashboardNav.map((item) => [item.href.slice(1), item.label]),
);

const SEGMENT_LABELS: Record<string, string> = {
  ...NAV_LABELS,
  completed: "Completed",
  history: "History",
  new: "New",
  suppliers: "Suppliers",
  uncovered: "Uncovered",
  reopen: "Manage Pre-Sell",
};

export function crumbsFromPathname(
  pathname: string,
  labels: Record<string, string> = {},
): DashboardBreadcrumbCrumb[] {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part, index) => {
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    return {
      href,
      label: labels[part] ?? SEGMENT_LABELS[part] ?? part,
      current: index === parts.length - 1,
    };
  });
}
