export const INVENTORY_IDEMPOTENCY_CONSTRAINTS = new Set([
  "stock_movements_organization_id_idempotency_key_sku",
  "stock_movements_organization_id_once_only_provenance",
]);

export const PAYMENT_IDEMPOTENCY_CONSTRAINTS = new Set([
  "payments_organization_id_idempotency_key_unique",
  "payments_idempotency_key_unique",
]);

type PostgresError = {
  readonly code?: unknown;
  readonly constraint_name?: unknown;
  readonly cause?: unknown;
};

export function isKnownIdempotencyUniqueViolation(
  error: unknown,
  constraints: ReadonlySet<string>,
): boolean {
  const seen = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const postgresError = current as PostgresError;
    if (
      postgresError.code === "23505" &&
      typeof postgresError.constraint_name === "string" &&
      constraints.has(postgresError.constraint_name)
    ) {
      return true;
    }
    current = postgresError.cause;
  }
  return false;
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
