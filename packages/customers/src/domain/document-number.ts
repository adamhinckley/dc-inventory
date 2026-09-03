const CUSTOMER_NUMBER_PREFIX = "CUST-";

export function formatCustomerNumber(sequence: number): string {
  return `${CUSTOMER_NUMBER_PREFIX}${String(sequence).padStart(5, "0")}`;
}

export function parseCustomerNumberSequence(customerNumber: string | undefined): number | null {
  if (customerNumber === undefined || customerNumber.length === 0) {
    return null;
  }
  if (!customerNumber.startsWith(CUSTOMER_NUMBER_PREFIX)) {
    return null;
  }
  const parsed = Number.parseInt(customerNumber.slice(CUSTOMER_NUMBER_PREFIX.length), 10);
  return Number.isFinite(parsed) ? parsed : null;
}
