import {
  buildPaymentReceivedRow,
  DrizzleInvoiceRepository,
  listPaymentsReceivedInMemory,
  PaymentId,
  type AccountingDrizzle,
  type IPaymentsReceivedListQuery,
  type PaymentsReceivedListPage,
  type PaymentsReceivedListQuery,
} from "@dc-inventory/accounting";
import { payments } from "@dc-inventory/accounting/schema";
import { CustomerId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";
import { DrizzleCustomerArProfileReadPort } from "./accounting-customer-ar-profile-read.js";

export class DrizzlePaymentsReceivedListQuery implements IPaymentsReceivedListQuery {
  constructor(private readonly db: AppDrizzle) {}

  async list(query: PaymentsReceivedListQuery): Promise<PaymentsReceivedListPage> {
    const profiles = await new DrizzleCustomerArProfileReadPort(this.db).listAll(
      query.organizationId,
    );
    const profileByCustomerId = new Map(
      profiles.map((profile) => [profile.customerId, profile]),
    );
    const repository = new DrizzleInvoiceRepository(
      this.db as unknown as AccountingDrizzle,
    );
    const paymentRows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.organizationId, query.organizationId));

    const rows = [];
    for (const row of paymentRows) {
      const profile = profileByCustomerId.get(CustomerId.parse(row.customerId));
      if (profile === undefined) {
        continue;
      }
      const payment = await repository.findPaymentById(
        query.organizationId,
        PaymentId.parse(row.id),
      );
      if (payment === null) {
        continue;
      }
      const applications = await repository.listApplicationsByPayment(
        query.organizationId,
        payment.id,
      );
      rows.push(buildPaymentReceivedRow(payment, applications, profile));
    }

    return listPaymentsReceivedInMemory(rows, query);
  }
}
