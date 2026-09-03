import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type UpdateBillToRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
  line1?: string;
  line2?: string | null;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
};

export type UpdateBillToResult =
  | { ok: true; billTo: BillTo }
  | { ok: false; reason: "not_found" | "invalid" };

function requiredText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class UpdateBillToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly billTos: IBillToRepository,
  ) {}

  async execute(input: UpdateBillToRequest): Promise<UpdateBillToResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.billTos.findByCustomerId(input.customerId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    const line1 = input.line1 === undefined ? existing.line1 : requiredText(input.line1);
    const city = input.city === undefined ? existing.city : requiredText(input.city);
    const region = input.region === undefined ? existing.region : requiredText(input.region);
    const postal = input.postal === undefined ? existing.postal : requiredText(input.postal);
    const country = input.country === undefined ? existing.country : requiredText(input.country);
    if (line1 === null || city === null || region === null || postal === null || country === null) {
      return { ok: false, reason: "invalid" };
    }
    let line2 = existing.line2;
    if (input.line2 !== undefined) {
      const trimmed = input.line2?.trim() ?? "";
      line2 = trimmed.length === 0 ? null : trimmed;
    }
    const billTo: BillTo = {
      customerId: existing.customerId,
      line1,
      line2,
      city,
      region,
      postal,
      country,
    };
    await this.billTos.save(billTo);
    return { ok: true, billTo };
  }
}
