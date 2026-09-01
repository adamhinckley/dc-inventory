"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { stripStaffTableUrlParams } from "../lib/table-url-params";

/** Clears unprefixed list query keys when navigating between staff routes. */
export function DashboardTableUrlCleanup() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    const current = pathname ?? "";
    if (
      previousPathname.current !== null &&
      previousPathname.current !== current
    ) {
      stripStaffTableUrlParams(current);
    }
    previousPathname.current = current;
  }, [pathname]);

  return null;
}
