import { listInternalSuppliersTable } from "@dc-inventory/api-client-internal";
import { SuppliersExplorer } from "../../../../components/suppliers-explorer";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";

type SuppliersSearchParams = Record<string, string | string[] | undefined>;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<SuppliersSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalSuppliersTable,
    await searchParams,
  );

  return <SuppliersExplorer initialParams={initialParams} />;
}
