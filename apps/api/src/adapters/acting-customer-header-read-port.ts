import { customers } from "@dc-inventory/customers/schema";
import type { ICustomerRepository } from "@dc-inventory/customers";
import { wholesaleUsers } from "@dc-inventory/identity/schema";
import type {
  ActingCustomerPickerRow,
  IActingCustomerHeaderReadPort,
  IWholesaleUserRepository,
  WholesaleLoginAccountStatus,
} from "@dc-inventory/identity";
import { CustomerId, type OrganizationId } from "@dc-inventory/shared-kernel";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

export function createActingCustomerHeaderReadPort(
  customerRepo: ICustomerRepository,
  wholesaleUserRepo: IWholesaleUserRepository,
  appDb?: AppDrizzle,
): IActingCustomerHeaderReadPort {
  return {
    async listPickerItems(organizationId): Promise<readonly ActingCustomerPickerRow[]> {
      if (appDb !== undefined) {
        const rows = await appDb
          .selectDistinct({
            customerId: customers.id,
            businessName: customers.name,
            customerNumber: customers.customerNumber,
            accountStatus: customers.accountStatus,
          })
          .from(wholesaleUsers)
          .innerJoin(
            customers,
            and(
              eq(customers.id, wholesaleUsers.customerId),
              eq(customers.organizationId, organizationId),
            ),
          )
          .where(
            and(
              eq(wholesaleUsers.organizationId, organizationId),
              inArray(customers.accountStatus, ["active", "on_hold"]),
            ),
          )
          .orderBy(asc(customers.name));
        return rows.map((row) => ({
          customerId: CustomerId.parse(row.customerId),
          businessName: row.businessName,
          customerNumber: row.customerNumber,
          accountStatus: row.accountStatus as WholesaleLoginAccountStatus,
        }));
      }
      const customerIds = await wholesaleUserRepo.listCustomerIdsWithWholesaleUsers(organizationId);
      const items: ActingCustomerPickerRow[] = [];
      for (const customerId of customerIds) {
        const customer = await customerRepo.findById(organizationId, customerId);
        if (customer === null || customer.accountStatus === "inactive") {
          continue;
        }
        items.push({
          customerId: customer.id,
          businessName: customer.name,
          customerNumber: customer.customerNumber,
          accountStatus: customer.accountStatus,
        });
      }
      return items;
    },
    async findById(organizationId: OrganizationId, customerId) {
      const customer = await customerRepo.findById(organizationId, customerId);
      if (customer === null) {
        return null;
      }
      return {
        customerId: customer.id,
        businessName: customer.name,
        customerNumber: customer.customerNumber,
      };
    },
  };
}
