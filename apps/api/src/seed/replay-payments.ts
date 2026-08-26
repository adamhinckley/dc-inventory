import {
  RecordPaymentUseCase,
  computeRemainingCents,
  type IClock,
  type IAccountingUnitOfWork,
  type IInvoiceRepository,
} from "@dc-inventory/accounting";
import type { ISalesOrderRepository } from "@dc-inventory/sales";
import { type OrderId, OrganizationId, type StaffUserId } from "@dc-inventory/shared-kernel";
import { selectPaymentReplay } from "./planner/payments.js";
import type { DemoBookPlan, PlannedShippedInvoice } from "./planner/types.js";

export class ReplayPaymentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReplayPaymentsError";
  }
}

export type PlaybackClock = IClock & {
  setInstant(instant: Date): void;
};

export type ReplayPaymentsPorts = {
  accountingUow: IAccountingUnitOfWork;
  clock: PlaybackClock;
  salesOrders: Pick<ISalesOrderRepository, "list">;
  invoices: Pick<
    IInvoiceRepository,
    "findByOrderId" | "findById" | "listApplications" | "findPaymentByIdempotencyKey"
  >;
};

export type ReplayPaymentsInput = {
  plan: DemoBookPlan;
  staffUserId: StaffUserId;
  assertWithinBudget?: () => void;
};

export type ReplayPaymentsResult = {
  paymentCount: number;
};

function salesOrderDocumentNumber(planIndex: number): string {
  return `SO-${String(planIndex + 1).padStart(5, "0")}`;
}

export async function buildSalesOrderIdByPlanKey(
  plan: DemoBookPlan,
  salesOrders: Pick<ISalesOrderRepository, "list">,
): Promise<Map<string, OrderId>> {
  const listed = await salesOrders.list({
    organizationId: OrganizationId.DEFAULT,
    page: 1,
    pageSize: 20_000,
  });
  const byDocumentNumber = new Map(listed.items.map((row) => [row.documentNumber, row.id]));
  const map = new Map<string, OrderId>();
  for (let index = 0; index < plan.salesOrders.length; index += 1) {
    const key = plan.salesOrders[index]!.key;
    const documentNumber = salesOrderDocumentNumber(index);
    const orderId = byDocumentNumber.get(documentNumber);
    if (orderId === undefined) {
      throw new ReplayPaymentsError(`missing sales order ${documentNumber}`);
    }
    map.set(key, orderId);
  }
  return map;
}

function paidInvoicesInReplayOrder(plan: DemoBookPlan): PlannedShippedInvoice[] {
  const keys = new Set(selectPaymentReplay(plan.shippedInvoices));
  return plan.shippedInvoices.filter((row) => keys.has(row.key));
}

export async function runReplayPayments(
  ports: ReplayPaymentsPorts,
  input: ReplayPaymentsInput,
): Promise<ReplayPaymentsResult> {
  const record = new RecordPaymentUseCase(ports.accountingUow, ports.clock);
  const salesOrderIdByKey = await buildSalesOrderIdByPlanKey(input.plan, ports.salesOrders);
  let paymentCount = 0;

  for (const planned of paidInvoicesInReplayOrder(input.plan)) {
    input.assertWithinBudget?.();
    const orderId = salesOrderIdByKey.get(planned.salesOrderKey);
    if (orderId === undefined) {
      throw new ReplayPaymentsError(`missing sales order key ${planned.salesOrderKey}`);
    }

    const invoice = await ports.invoices.findByOrderId(orderId);
    if (invoice === null) {
      throw new ReplayPaymentsError(`missing invoice for ${planned.key}`);
    }
    if (invoice.postedAt === null) {
      throw new ReplayPaymentsError(`invoice ${planned.key} is not posted`);
    }

    ports.clock.setInstant(invoice.postedAt);

    const applications = await ports.invoices.listApplications(invoice.id);
    const remaining = computeRemainingCents(invoice, applications);
    if (remaining <= 0) {
      throw new ReplayPaymentsError(`invoice ${planned.key} has no remaining balance`);
    }

    const result = await record.execute({
      staffUserId: input.staffUserId,
      invoiceId: invoice.id,
      amountCents: remaining,
      currency: invoice.total.currency,
      idempotencyKey: `demo:${planned.key}:payment`,
    });
    if (!result.ok) {
      throw new ReplayPaymentsError(`payment for ${planned.key} failed: ${result.reason}`);
    }
    if (result.remainingCents !== 0) {
      throw new ReplayPaymentsError(
        `payment for ${planned.key} left ${String(result.remainingCents)} cents`,
      );
    }

    paymentCount += 1;
  }

  return { paymentCount };
}
