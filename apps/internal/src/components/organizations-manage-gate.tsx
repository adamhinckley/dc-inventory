"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCanManageOrganizations } from "../lib/staff-organizations-manage";

export function OrganizationsManageGate({ children }: { children: ReactNode }) {
  const allowed = useCanManageOrganizations();

  if (!allowed) {
    return (
      <section className="section-flat max-w-xl p-panel">
        <h1 className="page-title">Not Available</h1>
        <p className="page-description mt-2">
          Only DEFAULT / platform admins can add companies.
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
