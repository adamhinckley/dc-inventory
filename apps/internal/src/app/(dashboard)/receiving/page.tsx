import { ReceivingInboundExplorer } from "../../../components/receiving-inbound-explorer";
import { receivingListTable } from "../../../lib/receiving-list-table";
import { listParamsFromSearchParams } from "../../../lib/table-url-params";

type ReceivingSearchParams = Record<string, string | string[] | undefined>;

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Promise<ReceivingSearchParams>;
}) {
  const initialParams = listParamsFromSearchParams(
    receivingListTable,
    await searchParams,
  );

  return <ReceivingInboundExplorer initialParams={initialParams} />;
}
