import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";

export class InMemoryBillToRepository implements IBillToRepository {
  private readonly byCustomerId = new Map<CustomerId, BillTo>();

  async findByCustomerId(customerId: CustomerId): Promise<BillTo | null> {
    return this.byCustomerId.get(customerId) ?? null;
  }

  async save(billTo: BillTo): Promise<void> {
    this.byCustomerId.set(billTo.customerId, billTo);
  }

  async deleteByCustomerId(customerId: CustomerId): Promise<void> {
    this.byCustomerId.delete(customerId);
  }
}
