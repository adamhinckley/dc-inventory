import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { ICreditCheckPort } from "../domain/ports/credit-check.js";

/** Derives available credit from limit minus exposure (accounting.md §7). */
export class LimitExposureCreditCheckPort implements ICreditCheckPort {
  constructor(
    private readonly creditLimitCents: number,
    private readonly exposureCents: number = 0,
  ) {}

  async availableCredit(
    _organizationId: OrganizationId,
    _customerId: CustomerId,
  ): Promise<number> {
    return this.creditLimitCents - this.exposureCents;
  }
}

export class InMemoryCreditCheckPort implements ICreditCheckPort {
  private readonly availableByCustomer = new Map<string, number>();

  setAvailableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
    availableCreditCents: number,
  ): void {
    this.availableByCustomer.set(`${organizationId}:${customerId}`, availableCreditCents);
  }

  async availableCredit(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<number> {
    const key = `${organizationId}:${customerId}`;
    if (!this.availableByCustomer.has(key)) {
      return Number.MAX_SAFE_INTEGER;
    }
    return this.availableByCustomer.get(key)!;
  }
}
