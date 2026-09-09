import {
  InMemoryCustomerBalancesListQuery,
  type ICustomerBalancesListQuery,
} from "@dc-inventory/accounting";
import {
  DrizzleOpenOrderExposureReadAdapter,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import type { AppDrizzle } from "../infrastructure/db.js";
import { createArCustomerReadPort } from "./accounting-ar-customer-read.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";

export function createCustomerBalancesListQuery(db: AppDrizzle): ICustomerBalancesListQuery {
  return new InMemoryCustomerBalancesListQuery(
    createArCustomerReadPort(db),
    new DrizzleCustomerArProfileReadPort(db),
    new DrizzleOpenOrderExposureReadAdapter(db as unknown as SalesDrizzle),
  );
}
