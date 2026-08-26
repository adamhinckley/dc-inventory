import type { CustomerId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { newUuid, ShipToId } from "../domain/ids.js";
import type { ICustomerRepository } from "../domain/ports/customer-repository.js";
import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export type CreateShipToRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  customerId: CustomerId;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
  isDefault?: boolean;
};

export type CreateShipToResult =
  | { ok: true; shipTo: ShipTo }
  | { ok: false; reason: "not_found" | "invalid" };

function requiredText(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateShipToUseCase {
  constructor(
    private readonly customers: ICustomerRepository,
    private readonly shipTos: IShipToRepository,
  ) {}

  async execute(input: CreateShipToRequest): Promise<CreateShipToResult> {
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
    const line2 = requiredText(input.line2 ?? undefined);
    const shipTo: ShipTo = {
      id: ShipToId.parse(newUuid()),
      customerId: input.customerId,
      line1,
      line2,
      city,
      region,
      postal,
      country,
      isDefault: input.isDefault === true,
    };
    await this.shipTos.save(shipTo);
    return { ok: true, shipTo };
  }
}
