"use client";

import { Breadcrumb } from "@dc-inventory/ui";
import { usePathname } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { crumbsFromPathname } from "../lib/dashboard-breadcrumbs";

const BreadcrumbLabelContext = createContext<{
  labels: Record<string, string>;
  setLabel: (key: string, label: string | null) => void;
} | null>(null);

export function DashboardBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});
  const setLabel = useCallback((key: string, label: string | null) => {
    setLabels((current) => {
      if (label == null) {
        if (!(key in current)) {
          return current;
        }
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (current[key] === label) {
        return current;
      }
      return { ...current, [key]: label };
    });
  }, []);

  const value = useMemo(() => ({ labels, setLabel }), [labels, setLabel]);

  return (
    <BreadcrumbLabelContext value={value}>{children}</BreadcrumbLabelContext>
  );
}

export function useBreadcrumbLabel(key: string | undefined, label: string | undefined) {
  const ctx = use(BreadcrumbLabelContext);
  if (!ctx) {
    throw new Error("useBreadcrumbLabel must be used within DashboardBreadcrumbProvider");
  }
  const { setLabel } = ctx;

  useEffect(() => {
    if (!key || !label) {
      return;
    }
    setLabel(key, label);
    return () => setLabel(key, null);
  }, [key, label, setLabel]);
}

export function DashboardBreadcrumb() {
  const pathname = usePathname();
  const ctx = use(BreadcrumbLabelContext);
  const crumbs = useMemo(
    () => crumbsFromPathname(pathname, ctx?.labels ?? {}),
    [ctx?.labels, pathname],
  );

  if (crumbs.length === 0) {
    return null;
  }

  return (
    <Breadcrumb data-testid="dashboard-topbar-breadcrumb">
      {crumbs.map((crumb) => (
        <Breadcrumb.Item key={crumb.href} href={crumb.href} current={crumb.current}>
          {crumb.label}
        </Breadcrumb.Item>
      ))}
    </Breadcrumb>
  );
}
