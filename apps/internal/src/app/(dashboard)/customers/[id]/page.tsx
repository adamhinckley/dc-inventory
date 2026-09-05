import { redirect } from "next/navigation";
import { CustomerDetailPage } from "../../../../components/customer-detail-page";
import { customersOrdersTable } from "../../../../lib/customers-orders-table";
import {
  customerDetailTabFromSearchParams,
  customerDetailTabHref,
  DEFAULT_CUSTOMER_DETAIL_TAB,
} from "../../../../lib/customer-detail-tabs";
import { listParamsFromSearchParams } from "../../../../lib/table-url-params";

type CustomerDetailSearchParams = Record<string, string | string[] | undefined>;

export default async function CustomerDetailRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CustomerDetailSearchParams>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  if (!resolvedSearchParams.tab) {
    redirect(customerDetailTabHref(id, DEFAULT_CUSTOMER_DETAIL_TAB));
  }

  const activeTab = customerDetailTabFromSearchParams(resolvedSearchParams);
  const ordersInitialParams = listParamsFromSearchParams(
    customersOrdersTable,
    resolvedSearchParams,
  );

  return (
    <CustomerDetailPage
      customerId={id}
      activeTab={activeTab}
      ordersInitialParams={ordersInitialParams}
    />
  );
}
