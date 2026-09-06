import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export type ListShipTosRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type ListShipTosResult =
  | { ok: true; items: ShipTo[] }
  | { ok: false; reason: "not_found" };

export class ListShipTosUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
  ) {}

  async execute(input: ListShipTosRequest): Promise<ListShipTosResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: true,
      items: await this.shipTos.listByCustomer(input.customerId),
    };
  }
}
