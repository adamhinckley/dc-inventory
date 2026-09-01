import {
  InMemoryInventoryUnitOfWork,
  RecordAllocatedUseCase,
  RecordCommittedUseCase,
  RecordDeallocatedUseCase,
  RecordDecommittedUseCase,
  RecordShippedUseCase,
  type IInventoryReadModel,
  type IStockLedger,
} from "@dc-inventory/inventory";
import { LocationId } from "@dc-inventory/shared-kernel";
import { InMemoryInvoiceRepository } from "@dc-inventory/accounting";
import type { IClock } from "../domain/clock.js";
import type {
  AllocatedCommand,
  CommittedCommand,
  DeallocatedCommand,
  DecommittedCommand,
  IInventoryCommandPort,
  InventorySnapshotLock,
  InventoryCommandResult,
  ISalesUnitOfWork,
  OrderCoverQuery,
  ShippedCommand,
} from "../domain/ports/sales-order-repository.js";
import { AccountingCommandAdapter } from "./accounting-command-adapter.js";
import { netOrderCoverQuantity } from "./order-cover.js";
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
  constructor(
    private readonly ledger: IStockLedger,
    private readonly readModel: IInventoryReadModel,
  ) {}

  lockSnapshots(snapshots: readonly InventorySnapshotLock[]): Promise<void> {
    return this.ledger.lockSnapshots(snapshots);
  }

  async recordCommitted(command: CommittedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordCommittedUseCase(this.ledger).execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async matchesCommittedIdempotency(command: CommittedCommand): Promise<boolean> {
    const movements = await this.readModel.listMovements({
      organizationId: command.organizationId,
      sku: command.sku,
      locationId: LocationId.DEFAULT,
    });
    const existing = movements.find((movement) => movement.idempotencyKey === command.idempotencyKey);
    if (existing === undefined) {
      return false;
    }
    return (
      existing.movementType === "Committed" &&
      existing.quantity === command.quantity &&
      existing.refType === "sales_order" &&
      existing.refId === command.orderId
    );
  }

  async recordDecommitted(command: DecommittedCommand): Promise<InventoryCommandResult> {
    return mapResult(
      await new RecordDecommittedUseCase(this.ledger).execute({
        organizationId: command.organizationId,
        idempotencyKey: command.idempotencyKey,
        sku: command.sku,
        quantity: command.quantity,
        refType: "sales_order",
        refId: command.orderId,
      }),
    );
  }

  async matchesDecommittedIdempotency(command: DecommittedCommand): Promise<boolean> {
    const movements = await this.readModel.listMovements({
      organizationId: command.organizationId,
      sku: command.sku,
      locationId: LocationId.DEFAULT,
    });
    const existing = movements.find((movement) => movement.idempotencyKey === command.idempotencyKey);
    if (existing === undefined) {
      return false;
    }
    return (
      existing.movementType === "Decommitted" &&
      existing.quantity === command.quantity &&
      existing.refType === "sales_order" &&
      existing.refId === command.orderId
    );
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

  async getOrderCoverQuantity(query: OrderCoverQuery): Promise<number> {
    const movements = await this.readModel.listMovements({
      organizationId: query.organizationId,
      sku: query.sku,
      locationId: LocationId.DEFAULT,
    });
    return netOrderCoverQuantity(movements, query.orderId);
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
    this.inventory = new InventoryCommandAdapter(
      this.inventoryUow.ledger,
      this.inventoryUow.readModel,
    );
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
