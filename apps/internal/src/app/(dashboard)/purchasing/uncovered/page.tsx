import { UncoveredFactorySummary } from "../../../../components/uncovered-factory-summary";

export default function UncoveredSkusPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header>
        <h1 className="page-title">Uncovered SKUs</h1>
        <p className="page-description mt-2">
          One row per factory with uncovered demand. Open a factory to review SKUs and
          build a purchase order, or select multiple factories to draft POs in bulk.
        </p>
      </header>
      <UncoveredFactorySummary />
    </section>
  );
}
