import type {
  CustomerArProfile,
  ICustomerArProfileReadPort,
} from "@dc-inventory/accounting";
import { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import { customers } from "@dc-inventory/customers/schema";
import type { AppDrizzle } from "../infrastructure/db.js";

function toProfile(row: typeof customers.$inferSelect): CustomerArProfile {
  return {
    customerId: CustomerId.parse(row.id),
    customerNumber: row.customerNumber,
    name: row.name,
    creditLimitCents: row.creditLimitCents,
    currency: row.currency,
  };
}

export class DrizzleCustomerArProfileReadPort implements ICustomerArProfileReadPort {
  constructor(private readonly db: AppDrizzle) {}

  async findById(
    organizationId: OrganizationId,
    customerId: CustomerId,
  ): Promise<CustomerArProfile | null> {
    const [row] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);
    if (row === undefined || row.organizationId !== organizationId) {
      return null;
    }
    return toProfile(row);
  }

  async listAll(organizationId: OrganizationId): Promise<readonly CustomerArProfile[]> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.organizationId, organizationId));
    return rows.map(toProfile);
  }
}
