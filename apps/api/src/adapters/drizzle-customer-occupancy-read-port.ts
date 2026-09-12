import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { sql } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { ICustomerOccupancyReadPort } from "./customer-occupancy-read-port.js";

function rowsFromExecute<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export class DrizzleCustomerOccupancyReadPort implements ICustomerOccupancyReadPort {
  constructor(private readonly db: AppDrizzle) {}

  async hasOccupancy(organizationId: OrganizationId, customerId: CustomerId): Promise<boolean> {
    const result = await this.db.execute<{ occupied: boolean }>(sql`
      SELECT (
        EXISTS (
          SELECT 1 FROM sales.orders
          WHERE organization_id = ${organizationId}
            AND customer_id = ${customerId}::uuid
        ) OR
        EXISTS (
          SELECT 1 FROM accounting.invoices
          WHERE organization_id = ${organizationId}
            AND customer_id = ${customerId}::uuid
        ) OR
        EXISTS (
          SELECT 1 FROM accounting.payments
          WHERE organization_id = ${organizationId}
            AND customer_id = ${customerId}::uuid
        ) OR
        EXISTS (
          SELECT 1 FROM accounting.payment_plans
          WHERE organization_id = ${organizationId}
            AND customer_id = ${customerId}::uuid
        )
      ) AS occupied
    `);
    const row = rowsFromExecute(result)[0];
    return row?.occupied === true;
  }
}
