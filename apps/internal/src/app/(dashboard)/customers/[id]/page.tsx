import { redirect } from "next/navigation";
import { CustomerDetailPage } from "../../../../components/customer-detail-page";
import {
  customerDetailTabFromSearchParams,
  customerDetailTabHref,
  DEFAULT_CUSTOMER_DETAIL_TAB,
} from "../../../../lib/customer-detail-tabs";

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

  return <CustomerDetailPage customerId={id} activeTab={activeTab} />;
}
