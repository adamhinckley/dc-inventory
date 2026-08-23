import type { CustomerId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { ShipToId } from "../domain/ids.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export type UpdateShipToRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
  shipToId: ShipToId;
  line1?: string;
  line2?: string | null;
  city?: string;
  region?: string;
  postal?: string;
  country?: string;
  isDefault?: boolean;
};

export type UpdateShipToResult =
  | { ok: true; shipTo: ShipTo }
  | { ok: false; reason: "not_found" | "invalid" };

function requiredText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class UpdateShipToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
  ) {}

  async execute(input: UpdateShipToRequest): Promise<UpdateShipToResult> {
    void input.staffUserId;
    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "not_found" };
    }
    const existing = await this.shipTos.findById(input.shipToId);
    if (existing === null || existing.customerId !== input.customerId) {
      return { ok: false, reason: "not_found" };
    }
    const line1 =
      input.line1 === undefined ? existing.line1 : requiredText(input.line1);
    const city = input.city === undefined ? existing.city : requiredText(input.city);
    const region =
      input.region === undefined ? existing.region : requiredText(input.region);
    const postal =
      input.postal === undefined ? existing.postal : requiredText(input.postal);
    const country =
      input.country === undefined ? existing.country : requiredText(input.country);
    if (line1 === null || city === null || region === null || postal === null || country === null) {
      return { ok: false, reason: "invalid" };
    }
    let line2 = existing.line2;
    if (input.line2 !== undefined) {
      const trimmed = input.line2?.trim() ?? "";
      line2 = trimmed.length === 0 ? null : trimmed;
    }
    const shipTo: ShipTo = {
      id: existing.id,
      customerId: existing.customerId,
      line1,
      line2,
      city,
      region,
      postal,
      country,
      isDefault: input.isDefault ?? existing.isDefault,
    };
    await this.shipTos.save(shipTo);
    return { ok: true, shipTo };
  }
}
