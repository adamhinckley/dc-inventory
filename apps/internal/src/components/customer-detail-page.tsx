"use client";

import { useGetInternalCustomer } from "@dc-inventory/api-client-internal";
import {
  Chip,
  DescriptionList,
  DetailView,
  formatMoneyMinorUnits,
  RouterTabs,
} from "@dc-inventory/ui";
import {
  CUSTOMER_DETAIL_TAB_KEYS,
  CUSTOMER_DETAIL_TAB_LABELS,
  customerDetailTabHref,
  type CustomerDetailTabKey,
} from "../lib/customer-detail-tabs";
import { customerAccountStatusLabel } from "../lib/customer-account-status";
import type { CustomerDetail } from "../lib/customer-types";
import { orvalDetailViewError } from "../lib/orval-query-load";
import { useCanManageMasterData } from "../lib/staff-master-data-manage";
import type { ListQueryParams } from "@dc-inventory/ui-internal";
import { useBreadcrumbLabel } from "./dashboard-breadcrumb";
import { CustomerBillToPanel } from "./customer-bill-to-panel";
import { CustomerCertificatesPanel } from "./customer-certificates-panel";
import { CustomerContactsPanel } from "./customer-contacts-panel";
import { CustomerEditForm } from "./customer-edit-form";
import { CustomerAccountingPanel } from "./customer-accounting-panel";
import { CustomerOrdersPanel } from "./customer-orders-panel";
import { CustomerShipTosPanel } from "./customer-ship-tos-panel";

function CustomerSummary({ customer }: { customer: CustomerDetail }) {
  return (
    <DescriptionList data-testid="customer-detail-summary">
      <DescriptionList.Heading>Account</DescriptionList.Heading>
      <DescriptionList.Item>
        <DescriptionList.Term>Terms</DescriptionList.Term>
        <DescriptionList.Data>{customer.terms}</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Credit limit</DescriptionList.Term>
        <DescriptionList.Data>
          {formatMoneyMinorUnits(customer.creditLimitCents, customer.currency)}
        </DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Tax ID</DescriptionList.Term>
        <DescriptionList.Data>{customer.taxId ?? "—"}</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Status</DescriptionList.Term>
        <DescriptionList.Data>
          {customerAccountStatusLabel(customer.accountStatus)}
        </DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Customer note</DescriptionList.Term>
        <DescriptionList.Data>{customer.customerNote ?? "—"}</DescriptionList.Data>
      </DescriptionList.Item>
      <DescriptionList.Item>
        <DescriptionList.Term>Staff note</DescriptionList.Term>
        <DescriptionList.Data>{customer.staffNote ?? "—"}</DescriptionList.Data>
      </DescriptionList.Item>
    </DescriptionList>
  );
}

function CustomerDetailTabPanel({
  customerId,
  activeTab,
  canManage,
  ordersInitialParams,
}: {
  customerId: string;
  activeTab: CustomerDetailTabKey;
  canManage: boolean;
  ordersInitialParams?: ListQueryParams;
}) {
  switch (activeTab) {
    case "ship-tos":
      return <CustomerShipTosPanel customerId={customerId} canManage={canManage} />;
    case "bill-to":
      return <CustomerBillToPanel customerId={customerId} canManage={canManage} />;
    case "contacts":
      return <CustomerContactsPanel customerId={customerId} canManage={canManage} />;
    case "certificates":
      return (
        <CustomerCertificatesPanel customerId={customerId} canManage={canManage} />
      );
    case "orders":
      return (
        <CustomerOrdersPanel
          customerId={customerId}
          initialParams={ordersInitialParams}
        />
      );
    case "accounting":
      return <CustomerAccountingPanel customerId={customerId} />;
  }
}

export function CustomerDetailPage({
  customerId,
  activeTab,
  ordersInitialParams,
}: {
  customerId: string;
  activeTab: CustomerDetailTabKey;
  ordersInitialParams?: ListQueryParams;
}) {
  const query = useGetInternalCustomer(customerId);
  const customer = query.data?.status === 200 ? query.data.data : undefined;
  const canManage = useCanManageMasterData();

  useBreadcrumbLabel(customerId, customer?.customerNumber);

  return (
    <DetailView<CustomerDetail>
      loading={query.isLoading}
      error={orvalDetailViewError(query)}
      data={customer}
    >
      {(loaded) => (
        <>
          <DetailView.Header>
            <header className="flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="page-title">{loaded.name}</h1>
                <p className="page-description mt-1 flex flex-wrap items-center gap-action tabular-nums">
                  <span>Customer #{loaded.customerNumber}</span>
                  <Chip icon={<Chip.Dot />}>
                    {customerAccountStatusLabel(loaded.accountStatus)}
                  </Chip>
                </p>
              </div>
              {canManage ? (
                <DetailView.EditButton
                  size="sm"
                  data-testid="customer-detail-edit-trigger"
                >
                  Edit Customer
                </DetailView.EditButton>
              ) : null}
            </header>
          </DetailView.Header>
          <DetailView.Summary>
            <CustomerSummary customer={loaded} />
          </DetailView.Summary>
          <DetailView.Tabs>
            <RouterTabs
              className="flex min-h-0 flex-1 flex-col"
              data-testid="customer-detail-router-tabs"
            >
              <RouterTabs.List>
                {CUSTOMER_DETAIL_TAB_KEYS.map((tab) => (
                  <RouterTabs.Trigger
                    key={tab}
                    href={customerDetailTabHref(customerId, tab)}
                  >
                    {CUSTOMER_DETAIL_TAB_LABELS[tab]}
                  </RouterTabs.Trigger>
                ))}
              </RouterTabs.List>
              <RouterTabs.Panel className="flex min-h-0 flex-1 flex-col p-0 pt-card">
                <CustomerDetailTabPanel
                  customerId={customerId}
                  activeTab={activeTab}
                  canManage={canManage}
                  ordersInitialParams={ordersInitialParams}
                />
              </RouterTabs.Panel>
            </RouterTabs>
          </DetailView.Tabs>
          {canManage ? (
            <DetailView.EditDialog
              title="Edit customer"
              data-testid="customer-detail-edit-dialog"
            >
              <CustomerEditForm customer={loaded} />
            </DetailView.EditDialog>
          ) : null}
        </>
      )}
    </DetailView>
  );
}
