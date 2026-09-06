import type { IShipToRepository } from "../domain/ports/ship-to-repository.js";
import type { ShipTo } from "../domain/ship-to.js";

export async function saveShipToWithExclusiveDefault(
  shipTos: IShipToRepository,
  shipTo: ShipTo,
): Promise<void> {
  if (shipTo.isDefault) {
    const siblings = await shipTos.listByCustomer(shipTo.customerId);
    for (const row of siblings) {
      if (row.id !== shipTo.id && row.isDefault) {
        await shipTos.save({ ...row, isDefault: false });
      }
    }
  }
  await shipTos.save(shipTo);
}
