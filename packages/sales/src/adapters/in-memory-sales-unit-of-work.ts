import {
  InMemoryInventoryUnitOfWork,
  RecordAllocatedUseCase,
  RecordDeallocatedUseCase,
  RecordShippedUseCase,
  type IStockLedger,
} from "@dc-inventory/inventory";
import { InMemoryInvoiceRepository } from "@dc-inventory/accounting";
import type { IClock } from "../domain/clock.js";
import type {
  AllocatedCommand,
  DeallocatedCommand,
  IInventoryCommandPort,
  InventorySnapshotLock,
  InventoryCommandResult,
  ISalesUnitOfWork,
  ShippedCommand,
} from "../domain/ports/sales-order-repository.js";
import { AccountingCommandAdapter } from "./accounting-command-adapter.js";
import { InMemorySalesOrderRepository } from "./in-memory-sales-order-repository.js";

function mapResult(
  result: { ok: true } | { ok: false; reason: string },
): InventoryCommandResult {
  if (result.ok) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: result.reason as InventoryCommandResult extends { ok: false; reason: infer R }
      ? R
      : never,
  };
}

class InventoryCommandAdapter implements IInventoryCommandPort {
  constructor(private readonly ledger: IStockLedger) {}

  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void> {
    return this.ledger.lockSnapshots(snapshots);
  }

  async recordAllocated(command: AllocatedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordAllocatedUseCase(this.ledger).execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async recordDeallocated(command: DeallocatedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordDeallocatedUseCase(this.ledger).execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async recordShipped(command: ShippedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordShippedUseCase(this.ledger).execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }
}

export class InMemorySalesUnitOfWork implements ISalesUnitOfWork {
  readonly salesOrders = new InMemorySalesOrderRepository();
  readonly invoices = new InMemoryInvoiceRepository();
  private readonly inventoryUow: InMemoryInventoryUnitOfWork;
  readonly inventory: InventoryCommandAdapter;
  readonly accounting: AccountingCommandAdapter;

  constructor(clock?: IClock) {
    this.inventoryUow = new InMemoryInventoryUnitOfWork(clock);
    this.inventory = new InventoryCommandAdapter(this.inventoryUow.ledger);
    this.accounting = new AccountingCommandAdapter(this.invoices, clock);
  }

  run<T>(work: (uow: ISalesUnitOfWork) => Promise<T>): Promise<T> {
    return this.inventoryUow.run(async () => {
      const salesSnap = this.salesOrders.snapshot();
      const invoiceSnap = this.invoices.snapshot();
      try {
        return await work(this);
      } catch (error) {
        this.salesOrders.restore(salesSnap);
        this.invoices.restore(invoiceSnap);
        throw error;
      }
    });
  }

  get inventoryReadModel() {
    return this.inventoryUow.readModel;
  }

  get ledger() {
    return this.inventoryUow.ledger;
  }
}
