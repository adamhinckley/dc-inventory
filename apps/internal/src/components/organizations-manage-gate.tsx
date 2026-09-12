"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useIsPlatformSession } from "../lib/staff-organizations-manage";

export function OrganizationsManageGate({ children }: { children: ReactNode }) {
  const allowed = useIsPlatformSession();

  if (!allowed) {
    return (
      <section className="section-flat max-w-xl p-panel">
        <h1 className="page-title">Not Available</h1>
        <p className="page-description mt-2">
          Only Platform users can manage companies.
        </p>
        <p className="mt-4">
          <Link href="/catalog" className="text-link hover:text-link-hover">
            Back to Catalog
          </Link>
        </p>
      </section>
    );
  }

  return children;
}
