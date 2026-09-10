import { projectCustomerArBalance } from "../domain/ar-projection.js";
import {
  computeAvailableCreditCents,
  computeExposureCents,
} from "../domain/invoice.js";
import type { IArCustomerReadPort } from "../domain/ports/ar-customer-read-port.js";
import type {
  AvailableCreditReadRequest,
  IAvailableCreditReadPort,
} from "../domain/ports/available-credit-read.js";
import type { ICustomerArProfileReadPort } from "../domain/ports/customer-ar-profile-read.js";
import type { IOpenOrderExposureReadPort } from "../domain/ports/open-order-exposure-read.js";

export class AvailableCreditReadAdapter implements IAvailableCreditReadPort {
  constructor(
    private readonly arCustomerRead: IArCustomerReadPort,
    private readonly customerProfiles: ICustomerArProfileReadPort,
    private readonly openOrderExposure: IOpenOrderExposureReadPort,
  ) {}

  async getAvailableCreditCents(request: AvailableCreditReadRequest): Promise<number> {
    const [loaded, profile, confirmedUnshippedCents] = await Promise.all([
      this.arCustomerRead.loadCustomerData(request.organizationId, request.customerId),
      this.customerProfiles.findById(request.organizationId, request.customerId),
      this.openOrderExposure.getOpenOrderExposureCents(
        request.organizationId,
        request.customerId,
      ),
    ]);

    const balance = projectCustomerArBalance(request.customerId, loaded, request.asOf);
    const creditLimitCents = profile?.creditLimitCents ?? 0;
    const exposureCents = computeExposureCents(
      balance.sumRemainingCents,
      confirmedUnshippedCents,
      balance.unappliedCreditCents,
    );
    return computeAvailableCreditCents(creditLimitCents, exposureCents);
  }
}
