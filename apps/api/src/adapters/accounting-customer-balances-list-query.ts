import {
  type CustomerBalancesListPage,
  type CustomerBalancesListQuery,
  type ICustomerBalancesListQuery,
} from "@dc-inventory/accounting";
import type { AppDrizzle } from "../infrastructure/db.js";
import { queryCustomerBalancesPage } from "./accounting-ar-sql-read.js";

export class DrizzleCustomerBalancesListQuery implements ICustomerBalancesListQuery {
  constructor(private readonly db: AppDrizzle) {}

  async list(query: CustomerBalancesListQuery): Promise<CustomerBalancesListPage> {
    return queryCustomerBalancesPage(this.db, query);
  }
}

export function createCustomerBalancesListQuery(db: AppDrizzle): ICustomerBalancesListQuery {
  return new DrizzleCustomerBalancesListQuery(db);
}
