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
  "pre-order": "Pre-order",
  "purchase-orders": "Purchase Orders",
  receiving: "Receiving",
  suppliers: "Suppliers",
  reopen: "Sell Windows",
};

function crumbHref(parts: string[], index: number): string {
  const part = parts[index];
  if (part === "pre-order" && parts[0] === "procurement" && index === 1) {
    return "/procurement";
  }
  return `/${parts.slice(0, index + 1).join("/")}`;
}

export function crumbsFromPathname(
  pathname: string,
  labels: Record<string, string> = {},
): DashboardBreadcrumbCrumb[] {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((part, index) => {
    return {
      href: crumbHref(parts, index),
      label: labels[part] ?? SEGMENT_LABELS[part] ?? part,
      current: index === parts.length - 1,
    };
  });
}
