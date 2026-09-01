"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { stripStaffTableUrlParams } from "../lib/table-url-params";

/** Clears unprefixed list query keys when navigating between staff routes. */
export function DashboardTableUrlCleanup() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);
  const skipNextStrip = useRef(false);

  useEffect(() => {
    const onPopState = () => {
      skipNextStrip.current = true;
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const current = pathname ?? "";
    if (
      previousPathname.current !== null &&
      previousPathname.current !== current
    ) {
      if (!skipNextStrip.current) {
        stripStaffTableUrlParams(current);
      }
      skipNextStrip.current = false;
    }
    previousPathname.current = current;
  }, [pathname]);

  return null;
}
