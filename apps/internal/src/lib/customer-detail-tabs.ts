export const CUSTOMER_DETAIL_TAB_KEYS = [
  "ship-tos",
  "bill-to",
  "contacts",
  "certificates",
  "orders",
  // PROTOTYPE — real tab lands with ADA-363; remove this comment then.
  "accounting",
] as const;

export type CustomerDetailTabKey = (typeof CUSTOMER_DETAIL_TAB_KEYS)[number];

export const DEFAULT_CUSTOMER_DETAIL_TAB: CustomerDetailTabKey = "ship-tos";

export const CUSTOMER_DETAIL_TAB_LABELS: Record<CustomerDetailTabKey, string> = {
  "ship-tos": "Ship-Tos",
  "bill-to": "Bill-To",
  contacts: "Contacts",
  certificates: "Certificates",
  orders: "Orders",
  accounting: "Accounting",
};

export function customerDetailTabHref(
  customerId: string,
  tab: CustomerDetailTabKey,
): string {
  return `/customers/${customerId}?tab=${tab}`;
}

export function customerDetailTabFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): CustomerDetailTabKey {
  const raw = searchParams.tab;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (CUSTOMER_DETAIL_TAB_KEYS as readonly string[]).includes(value)) {
    return value as CustomerDetailTabKey;
  }
  return DEFAULT_CUSTOMER_DETAIL_TAB;
}
