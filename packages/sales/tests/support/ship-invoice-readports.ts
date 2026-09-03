import type { ICustomerBillToSnapshotReadPort } from "../../src/index.js";
import type { ICustomerTermsReadPort } from "@dc-inventory/accounting";

export const testShipBillToSnapshot: ICustomerBillToSnapshotReadPort = {
  getBillToAddressSnapshot: async () => ({
    line1: "100 Main St",
    line2: null,
    city: "Portland",
    region: "OR",
    postal: "97201",
    country: "US",
  }),
};

export const testShipCustomerTerms: ICustomerTermsReadPort = {
  getTerms: async () => "Net 30",
};
