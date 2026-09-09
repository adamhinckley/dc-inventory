import { AccountingPaymentsTable } from "../../../../components/accounting-payments-table";
import {
  accountingAsOfFromSearchParams,
  accountingPaymentsInitialParams,
} from "../../../../lib/accounting-url-params";

type AccountingSearchParams = Record<string, string | string[] | undefined>;

export default async function AccountingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<AccountingSearchParams>;
}) {
  const resolved = await searchParams;
  const initialParams = accountingPaymentsInitialParams(resolved);
  const asOf = accountingAsOfFromSearchParams(resolved);

  return <AccountingPaymentsTable initialParams={initialParams} asOf={asOf} />;
}
