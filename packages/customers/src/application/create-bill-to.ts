import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../domain/bill-to.js";
import type { IBillToRepository } from "../domain/ports/bill-to-repository.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";

export type CreateBillToRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type CreateBillToResult =
  | { ok: true; billTo: BillTo }
  | { ok: false; reason: "not_found" | "invalid" | "already_exists" };

function requiredText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateBillToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly billTos: IBillToRepository,
  ) {}

  async execute(input: CreateBillToRequest): Promise<CreateBillToResult> {
    void input.staffUserId;
    const line1 = requiredText(input.line1);
    const city = requiredText(input.city);
    const region = requiredText(input.region);
    const postal = requiredText(input.postal);
    const country = requiredText(input.country);
    if (line1 === null || city === null || region === null || postal === null || country === null) {
      return { ok: false, reason: "invalid" };
    }
    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.billTos.findByCustomerId(input.customerId);
    if (existing !== null) {
      return { ok: false, reason: "already_exists" };
    }
    const line2 = requiredText(input.line2 ?? undefined);
    const billTo: BillTo = {
      customerId: input.customerId,
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
