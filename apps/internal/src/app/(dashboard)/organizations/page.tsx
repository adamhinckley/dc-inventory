import { listInternalOrganizationsTable } from "@dc-inventory/api-client-internal";
import { OrganizationsExplorer } from "../../../components/organizations-explorer";
import { OrganizationsManageGate } from "../../../components/organizations-manage-gate";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type OrganizationsSearchParams = Record<string, string | string[] | undefined>;

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<OrganizationsSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    listInternalOrganizationsTable,
    await searchParams,
  );

  return (
    <OrganizationsManageGate>
      <OrganizationsExplorer initialParams={initialParams} />
    </OrganizationsManageGate>
  );
}
