import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ShipToAddressSnapshot } from "../src/domain/ports/customer-ship-to-snapshot-read.js";

export const TEST_SHIP_TO_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

export const TEST_SHIP_TO_SNAPSHOT: ShipToAddressSnapshot = {
  line1: "200 Ship St",
  line2: "Suite 5",
  city: "Seattle",
  region: "WA",
  postal: "98101",
  country: "US",
};

export function seedTestShipTo(
  port: {
    seed: (customerId: CustomerId, shipToId: string, snapshot: ShipToAddressSnapshot) => void;
  },
  customerId: CustomerId,
): void {
  port.seed(customerId, TEST_SHIP_TO_ID, TEST_SHIP_TO_SNAPSHOT);
}
