import { ShipToId, type IShipToRepository } from "@dc-inventory/customers";
import type { CustomerId } from "@dc-inventory/shared-kernel";

export const API_TEST_SHIP_TO_ID = ShipToId.parse("dddddddd-dddd-4ddd-8ddd-dddddddddddd");
export const API_TEST_SHIP_TO_ID_B = ShipToId.parse("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");

export async function seedShipTo(
  shipTos: IShipToRepository,
  customerId: CustomerId,
  id: ShipToId,
  line1: string,
): Promise<void> {
  await shipTos.save({
    id,
    customerId,
    line1,
    line2: "Suite 5",
    city: "Seattle",
    region: "WA",
    postal: "98101",
    country: "US",
    isDefault: true,
  });
}

export async function seedDefaultShipTo(
  shipTos: IShipToRepository,
  customerId: CustomerId,
): Promise<void> {
  await seedShipTo(shipTos, customerId, API_TEST_SHIP_TO_ID, "200 Ship St");
}
