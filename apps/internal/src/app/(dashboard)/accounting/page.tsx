import { AccountingBalancesTable } from "../../../components/accounting-balances-table";
import { accountingBalancesInitialParams } from "../../../lib/accounting-url-params";

type AccountingSearchParams = Record<string, string | string[] | undefined>;

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<AccountingSearchParams>;
}) {
  const initialParams = accountingBalancesInitialParams(await searchParams);

  return <AccountingBalancesTable initialParams={initialParams} />;
}
