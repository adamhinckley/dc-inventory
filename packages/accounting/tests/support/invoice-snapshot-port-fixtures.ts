import type {
  ICustomerBillToSnapshotReadPort,
  ICustomerTermsReadPort,
} from "../../src/index.js";

export const TEST_BILL_TO = {
  line1: "500 Invoice Ave",
  line2: "Suite 2",
  city: "Salt Lake City",
  region: "UT",
  postal: "84101",
  country: "US",
};

export function testInvoiceSnapshotPorts(
  billTo: typeof TEST_BILL_TO | null = TEST_BILL_TO,
  terms: string | null = "Net 30",
): {
  billToSnapshot: ICustomerBillToSnapshotReadPort;
  customerTerms: ICustomerTermsReadPort;
} {
  return {
    billToSnapshot: {
      getBillToAddressSnapshot: async () => billTo,
    },
    customerTerms: {
      getTerms: async () => terms,
    },
  };
}
