import { listInternalCustomersTable } from "@dc-inventory/api-client-internal";
import { CustomersExplorer } from "../../../components/customers-explorer";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type CustomersSearchParams = Record<string, string | string[] | undefined>;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalCustomersTable,
    await searchParams,
  );

  return <CustomersExplorer initialParams={initialParams} />;
}
