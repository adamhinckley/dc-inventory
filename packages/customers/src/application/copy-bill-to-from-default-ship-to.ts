import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";

export type CopyBillToFromDefaultShipToRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type CopyBillToFromDefaultShipToResult =
  | { ok: true; billTo: BillTo }
  | { ok: false; reason: "not_found" | "no_default_ship_to" };

export class CopyBillToFromDefaultShipToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
    private readonly billTos: IBillToRepository,
  ) {}

  async execute(
    input: CopyBillToFromDefaultShipToRequest,
  ): Promise<CopyBillToFromDefaultShipToResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const shipTos = await this.shipTos.listByCustomer(input.customerId);
    const defaultShipTo = shipTos.find((row) => row.isDefault);
    if (defaultShipTo === undefined) {
      return { ok: false, reason: "no_default_ship_to" };
    }
    const billTo: BillTo = {
      customerId: input.customerId,
      line1: defaultShipTo.line1,
      line2: defaultShipTo.line2,
      city: defaultShipTo.city,
      region: defaultShipTo.region,
      postal: defaultShipTo.postal,
      country: defaultShipTo.country,
    };
    await this.billTos.save(billTo);
    return { ok: true, billTo };
  }
}
