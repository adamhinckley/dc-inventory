import type {
  ICustomerBillToSnapshotReadPort,
  ICustomerTermsReadPort,
} from "@dc-inventory/accounting";

export function testShipAccountingReadPorts(): {
  billToSnapshot: ICustomerBillToSnapshotReadPort;
  customerTerms: ICustomerTermsReadPort;
} {
  return {
    billToSnapshot: {
      getBillToAddressSnapshot: async () => ({
        line1: "1 Test Way",
        line2: null,
        city: "Portland",
        region: "OR",
        postal: "97201",
        country: "US",
      }),
    },
    customerTerms: {
      getTerms: async () => "Net 30",
    },
  };
}
