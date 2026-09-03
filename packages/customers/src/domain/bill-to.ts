import type { CustomerId } from "@dc-inventory/shared-kernel";

export type BillTo = {
  customerId: CustomerId;
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type BillToAddressSnapshot = {
  line1: string;
  line2: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
};
