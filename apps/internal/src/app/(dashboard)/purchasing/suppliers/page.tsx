import Link from "next/link";
import { SuppliersExplorer } from "../../../../components/suppliers-explorer";
import { suppliersListTable } from "../../../../lib/suppliers-list-table";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";

type SuppliersSearchParams = Record<string, string | string[] | undefined>;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SuppliersSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    suppliersListTable,
    await searchParams,
  );

  return (
    <SuppliersExplorer initialParams={initialParams}>
      <nav className="text-body-sm text-fg-secondary">
        <Link href="/purchasing" className="text-link hover:text-link-hover">
          Purchasing
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Suppliers</span>
      </nav>
    </SuppliersExplorer>
  );
}
