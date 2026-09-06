import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export async function saveShipToWithExclusiveDefault(
  shipTos: IShipToRepository,
  shipTo: ShipTo,
): Promise<void> {
  await shipTos.save(shipTo);
}
