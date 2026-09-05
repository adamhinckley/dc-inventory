import { ShipToId, type IShipToRepository } from "@dc-inventory/customers";
import type { CustomerId } from "@dc-inventory/shared-kernel";

export const API_TEST_SHIP_TO_ID = ShipToId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

export async function seedDefaultShipTo(
  shipTos: IShipToRepository,
  customerId: CustomerId,
): Promise<void> {
  await shipTos.save({
    id: API_TEST_SHIP_TO_ID,
    customerId,
    line1: "200 Ship St",
    line2: "Suite 5",
    city: "Seattle",
    region: "WA",
    postal: "98101",
    country: "US",
    isDefault: true,
  });
}
