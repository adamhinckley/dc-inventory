import { UncoveredVendorDetail } from "../../../../../../components/prototype/uncovered-vendor-detail";

/** PROTOTYPE drill-down — uncovered SKUs for one vendor. */
export default async function UncoveredVendorPrototypeDetailPage({
  params,
}: {
  params: Promise<{ vendorKey: string }>;
}) {
  const { vendorKey } = await params;
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <UncoveredVendorDetail vendorKey={vendorKey} />
    </section>
  );
}
