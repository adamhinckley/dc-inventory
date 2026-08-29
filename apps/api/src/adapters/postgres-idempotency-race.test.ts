import { describe, expect, it, vi } from "vitest";
import {
  INVENTORY_IDEMPOTENCY_CONSTRAINTS,
  PAYMENT_IDEMPOTENCY_CONSTRAINTS,
  isKnownIdempotencyUniqueViolation,
  retryAfterIdempotencyRace,
} from "./postgres-idempotency-race.js";

function uniqueViolation(constraintName: string) {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: constraintName,
  });
}

describe("PostgreSQL idempotency race classification", () => {
  it.each([
    [
      INVENTORY_IDEMPOTENCY_CONSTRAINTS,
      "stock_movements_organization_id_idempotency_key_sku",
    ],
    [
      INVENTORY_IDEMPOTENCY_CONSTRAINTS,
      "stock_movements_organization_id_once_only_provenance",
    ],
    [PAYMENT_IDEMPOTENCY_CONSTRAINTS, "payments_organization_id_idempotency_key_unique"],
  ])("recognizes 23505 for known constraint %s", (constraints, constraintName) => {
    expect(isKnownIdempotencyUniqueViolation(uniqueViolation(constraintName), constraints)).toBe(
      true,
    );
  });

  it("does not classify unknown unique constraints or non-unique errors", () => {
    expect(
      isKnownIdempotencyUniqueViolation(
        uniqueViolation("invoices_organization_id_document_number_unique"),
        PAYMENT_IDEMPOTENCY_CONSTRAINTS,
      ),
    ).toBe(false);
    expect(
      isKnownIdempotencyUniqueViolation(
        Object.assign(new Error("serialization failure"), {
          code: "40001",
          constraint_name: "payments_organization_id_idempotency_key_unique",
        }),
        PAYMENT_IDEMPOTENCY_CONSTRAINTS,
      ),
    ).toBe(false);
  });

  it("retries once after a known race and lets the replay result through", async () => {
    const operation = vi
      .fn<() => Promise<{ ok: true }>>()
      .mockRejectedValueOnce(
        uniqueViolation("payments_organization_id_idempotency_key_unique"),
      )
      .mockResolvedValueOnce({ ok: true });

    await expect(
      retryAfterIdempotencyRace(operation, PAYMENT_IDEMPOTENCY_CONSTRAINTS),
    ).resolves.toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry an unknown unique violation", async () => {
    const error = uniqueViolation("payment_applications_pkey");
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(
      retryAfterIdempotencyRace(operation, PAYMENT_IDEMPOTENCY_CONSTRAINTS),
    ).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
  });
});
