import { DEMO_COUNTS, type DemoCounts } from "./constants.js";
import type {
  PlannedCustomer,
  PlannedSalesOrder,
  PlannedShippedInvoice,
} from "./types.js";

function subtotalForOrder(order: PlannedSalesOrder): number {
  return order.lines.reduce((sum, line) => sum + line.qty * line.unitPriceCents, 0);
}

export function planShippedInvoices(input: {
  salesOrders: readonly PlannedSalesOrder[];
  customers: readonly PlannedCustomer[];
  seedToday: Date;
  idleParkInstants: ReadonlyMap<string, Date>;
  counts?: DemoCounts;
}): PlannedShippedInvoice[] {
  const counts = input.counts ?? DEMO_COUNTS;
  const shipped = input.salesOrders
    .filter((row) => row.status === "shipped")
    .map((order, index) => {
      const instant = input.idleParkInstants.get(order.key) ?? order.plannedInstant;
      return {
        key: `inv-${order.key}`,
        salesOrderKey: order.key,
        customerKey: order.customerKey,
        plannedInstant: instant,
        subtotalCents: subtotalForOrder(order),
        paid: true as boolean,
        replaySequence: index + 1,
      } satisfies PlannedShippedInvoice;
    });

  if (shipped.length !== counts.invoices) {
    throw new Error(`expected ${String(counts.invoices)} shipped invoices`);
  }

  const customerByKey = new Map(input.customers.map((row) => [row.key, row]));
  for (const invoice of shipped) {
    const customer = customerByKey.get(invoice.customerKey);
    if (!customer) {
      throw new Error(`missing customer for invoice ${invoice.key}`);
    }
    if (customer.persona === "idlePark") {
      invoice.paid = false;
    }
  }

  const mixInvoices = shipped.filter((row) => customerByKey.get(row.customerKey)?.persona === "mix");
  const mixUnpaidTarget = counts.mixUnpaidInvoices;
  if (mixInvoices.length < mixUnpaidTarget) {
    throw new Error(
      `mix shipped invoices ${String(mixInvoices.length)} cannot supply ${String(mixUnpaidTarget)} unpaid rows`,
    );
  }

  const sortedMix = [...mixInvoices].sort((left, right) => {
    const byInstant = right.plannedInstant.getTime() - left.plannedInstant.getTime();
    if (byInstant !== 0) {
      return byInstant;
    }
    return right.replaySequence - left.replaySequence;
  });
  const mixUnpaid = new Set(sortedMix.slice(0, mixUnpaidTarget).map((row) => row.key));
  for (const invoice of shipped) {
    const customer = customerByKey.get(invoice.customerKey);
    if (customer?.persona === "mix" && mixUnpaid.has(invoice.key)) {
      invoice.paid = false;
    }
  }

  const paidCount = shipped.filter((row) => row.paid).length;
  const unpaidCount = shipped.length - paidCount;
  if (paidCount !== counts.payments) {
    throw new Error(`paid invoice count ${String(paidCount)}`);
  }
  if (unpaidCount !== counts.unpaidInvoices) {
    throw new Error(`unpaid invoice count ${String(unpaidCount)}`);
  }

  for (const persona of ["acme", "northstar", "harvest"] as const) {
    const bad = shipped.find(
      (row) => customerByKey.get(row.customerKey)?.persona === persona && !row.paid,
    );
    if (bad) {
      throw new Error(`${persona} has an unpaid invoice in the payment plan`);
    }
  }

  return shipped;
}

export function selectPaymentReplay(invoices: readonly PlannedShippedInvoice[]): string[] {
  return invoices.filter((row) => row.paid).map((row) => row.key);
}

export function selectUnpaidReplay(invoices: readonly PlannedShippedInvoice[]): string[] {
  return invoices
    .filter((row) => !row.paid)
    .sort((left, right) => {
      const byInstant = right.plannedInstant.getTime() - left.plannedInstant.getTime();
      if (byInstant !== 0) {
        return byInstant;
      }
      return right.replaySequence - left.replaySequence;
    })
    .map((row) => row.key);
}
