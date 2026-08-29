export const INVENTORY_IDEMPOTENCY_CONSTRAINTS = new Set([
  "stock_movements_organization_id_idempotency_key_sku",
  "stock_movements_organization_id_once_only_provenance",
]);

export const PAYMENT_IDEMPOTENCY_CONSTRAINTS = new Set([
  "payments_organization_id_idempotency_key_unique",
]);

type PostgresError = {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
};

export function isKnownIdempotencyUniqueViolation(
  error: unknown,
  constraints: ReadonlySet<string>,
): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const postgresError = error as PostgresError;
  return (
    postgresError.code === "23505" &&
    typeof postgresError.constraint_name === "string" &&
    constraints.has(postgresError.constraint_name)
  );
}

export async function retryAfterIdempotencyRace<T>(
  operation: () => Promise<T>,
  constraints: ReadonlySet<string>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isKnownIdempotencyUniqueViolation(error, constraints)) {
      throw error;
    }
    return operation();
  }
}
