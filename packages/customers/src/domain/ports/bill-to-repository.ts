import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { BillTo } from "../bill-to.js";

export interface IBillToRepository {
  findByCustomerId(customerId: CustomerId): Promise<BillTo | null>;
  save(billTo: BillTo): Promise<void>;
  deleteByCustomerId(customerId: CustomerId): Promise<void>;
}
