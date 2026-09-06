import Link from "next/link";
import { UncoveredVendorSummary } from "../../../../../components/prototype/uncovered-vendor-summary";

/** PROTOTYPE route — vendor summary for uncovered demand. See grilling spec Sep 2026. */
export default function UncoveredVendorPrototypePage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header>
        <p className="text-body-sm text-fg-secondary">
          <Link href="/purchasing/uncovered" className="text-link hover:text-link-hover">
            ← Current uncovered page
          </Link>
        </p>
        <h1 className="page-title mt-2">Uncovered SKUs (prototype)</h1>
        <p className="page-description mt-2">
          Uncovered demand by factory. Open a factory to review products and build a
          purchase order.
        </p>
      </header>
      <UncoveredVendorSummary />
    </section>
  );
}
