import type { CustomerId, OrganizationId } from "@dc-inventory/shared-kernel";
import {
  deriveCustomerInvoiceRows,
} from "../domain/ar-projection.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { ILastOrderDateReadPort } from "../domain/ports/last-order-date-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";
import {
  buildCustomerAccountingSummaryResult,
  type CustomerInvoiceProjectionRow,
  type CustomerPaymentProjectionRow,
  type GetCustomerAccountingSummaryResult,
} from "./get-customer-accounting-summary.js";

export type GetCustomerAccountingWorkspaceRequest = {
  readonly organizationId: OrganizationId;
  readonly customerId: CustomerId;
  readonly asOf: Date;
};

export type GetCustomerAccountingWorkspaceResult = {
  readonly summary: GetCustomerAccountingSummaryResult;
  readonly invoices: readonly CustomerInvoiceProjectionRow[];
  readonly payments: readonly CustomerPaymentProjectionRow[];
};

export class GetCustomerAccountingWorkspaceUseCase {
  constructor(
    private readonly arCustomerRead: IArCustomerReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
    private readonly lastOrderDate: ILastOrderDateReadPort,
  ) {}

  async execute(
    input: GetCustomerAccountingWorkspaceRequest,
  ): Promise<GetCustomerAccountingWorkspaceResult> {
    const [loaded, profile, confirmedUnshippedCents, lastOrderDate] = await Promise.all([
      this.arCustomerRead.loadCustomerData(input.organizationId, input.customerId),
      this.customerProfiles.findById(input.organizationId, input.customerId),
      this.openOrderExposure.getOpenOrderExposureCents(
        input.organizationId,
        input.customerId,
      ),
      this.lastOrderDate.getLastOrderDate(input.organizationId, input.customerId),
    ]);

    const summary = buildCustomerAccountingSummaryResult({
      loaded,
      profile,
      confirmedUnshippedCents,
      lastOrderDate,
      customerId: input.customerId,
      asOf: input.asOf,
    });

    return {
      summary,
      invoices: deriveCustomerInvoiceRows(loaded, input.asOf, true),
      payments: summary.recentPayments,
    };
  }
}
