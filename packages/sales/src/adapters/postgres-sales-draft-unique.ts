export const SALES_DRAFT_PER_CUSTOMER_CONSTRAINT =
  "orders_organization_id_customer_id_draft_unique";

export class SalesDraftPerCustomerUniqueViolationError extends Error {
  readonly constraintName = SALES_DRAFT_PER_CUSTOMER_CONSTRAINT;

  constructor() {
    super("draft sales order already exists for customer");
    this.name = "SalesDraftPerCustomerUniqueViolationError";
  }
}

type PostgresError = {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
  readonly cause?: unknown;
};

export function isSalesDraftPerCustomerUniqueViolation(error: unknown): boolean {
  if (error instanceof SalesDraftPerCustomerUniqueViolationError) {
    return true;
  }
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const postgresError = current as PostgresError;
    if (
      postgresError.code === "23505" &&
      postgresError.constraint_name === SALES_DRAFT_PER_CUSTOMER_CONSTRAINT
    ) {
      return true;
    }
    current = postgresError.cause;
  }
  return false;
}
