import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ShipToId } from "../ids.js";
import type { ShipTo } from "../ship-to.js";

export interface IShipToRepository {
  listByCustomer(customerId: CustomerId): Promise<ShipTo[]>;
  findById(id: ShipToId): Promise<ShipTo | null>;
  save(shipTo: ShipTo): Promise<void>;
}
