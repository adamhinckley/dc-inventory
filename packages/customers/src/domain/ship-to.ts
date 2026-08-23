import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ShipToId } from "./ids.js";

export type ShipTo = {
  id: ShipToId;
  customerId: CustomerId;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
  isDefault: boolean;
};
