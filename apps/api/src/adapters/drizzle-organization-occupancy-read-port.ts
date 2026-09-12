import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { IOrganizationOccupancyReadPort } from "./organization-occupancy-read-port.js";

function rowsFromExecute<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export class DrizzleOrganizationOccupancyReadPort implements IOrganizationOccupancyReadPort {
  constructor(private readonly db: AppDrizzle) {}

  async hasOccupancy(organizationId: OrganizationId): Promise<boolean> {
    const result = await this.db.execute<{ occupied: boolean }>(sql`
      SELECT (
        EXISTS (SELECT 1 FROM catalog.products WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM customers.customers WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM sales.orders WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM purchasing.suppliers WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM purchasing.purchase_orders WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM inventory.stock_snapshots WHERE organization_id = ${organizationId}) OR
        EXISTS (SELECT 1 FROM inventory.stock_movements WHERE organization_id = ${organizationId})
      ) AS occupied
    `);
    const row = rowsFromExecute(result)[0];
    return row?.occupied === true;
  }
}
