import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type GetBillToRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
};

export type GetBillToResult =
  | { ok: true; billTo: BillTo }
  | { ok: false; reason: "not_found" };

export class GetBillToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly billTos: IBillToRepository,
  ) {}

  async execute(input: GetBillToRequest): Promise<GetBillToResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const billTo = await this.billTos.findByCustomerId(input.customerId);
    if (billTo === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, billTo };
  }
}
