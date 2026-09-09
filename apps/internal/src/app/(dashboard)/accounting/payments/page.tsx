import { AccountingPaymentsTable } from "../../../../components/accounting-payments-table";
import {
  accountingAsOfFromSearchParams,
  accountingPaymentDateRange,
  accountingPaymentRangeFromSearchParams,
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
  const initialRange = accountingPaymentRangeFromSearchParams(resolved);
  const { from: initialFrom, to: initialTo } = accountingPaymentDateRange(
    asOf,
    initialRange,
    resolved,
  );

  return (
    <AccountingPaymentsTable
      initialParams={initialParams}
      asOf={asOf}
      initialRange={initialRange}
      initialFrom={initialFrom}
      initialTo={initialTo}
    />
  );
}
