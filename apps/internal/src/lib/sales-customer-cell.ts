export type SalesCustomerCell =
  | { kind: "link"; href: string; label: string }
  | { kind: "dash" };

export function salesCustomerCell(row: {
  customerId?: string | null;
  customerName?: string | null;
}): SalesCustomerCell {
  const customerId = row.customerId?.trim();
  if (!customerId) {
    return { kind: "dash" };
  }

  const customerName = row.customerName?.trim();
  const label = customerName ? customerName : "Unknown customer";

  return {
    kind: "link",
    href: `/customers/${customerId}`,
    label,
  };
}
