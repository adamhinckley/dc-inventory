import type { AppDrizzle } from "../infrastructure/db.js";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import {
  DrizzleInventoryReadModel,
  DrizzleStockLedger,
  type InventoryDrizzle,
} from "@dc-inventory/inventory";
import {
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierRepository,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import {
  DrizzleSalesOrderRepository,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import { LocationId } from "@dc-inventory/shared-kernel";
import { eq } from "drizzle-orm";
import { locations } from "@dc-inventory/inventory/schema";
import { StockLedgerInventoryCommandAdapter } from "./inventory-command-port.js";
import { SalesStockLedgerInventoryCommandAdapter } from "./sales-inventory-command-port.js";

/**
 * Postgres-backed unit of work for the composition root.
 * Serializes callers and runs each callback in one Drizzle transaction.
 */
export class PostgresInventoryUnitOfWork implements IUnitOfWork {
  private defaultLocationUuid: Promise<string> | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: AppDrizzle) {}

  readonly inventory = {
    ledger: null as unknown as DrizzleStockLedger,
    readModel: null as unknown as DrizzleInventoryReadModel,
  };

  get purchasing(): IUnitOfWork["purchasing"] {
    const self = this;
    return {
      get purchaseOrders(): never {
        throw new Error("Access purchasing repositories inside unitOfWork.run");
      },
      get suppliers(): never {
        throw new Error("Access purchasing repositories inside unitOfWork.run");
      },
      get inventory(): never {
        throw new Error("Access inventory commands inside unitOfWork.run");
      },
      run: (work) => self.run((scope) => work(scope.purchasing)),
    };
  }

  get sales(): IUnitOfWork["sales"] {
    const self = this;
    return {
      get salesOrders(): never {
        throw new Error("Access sales repositories inside unitOfWork.run");
      },
      get inventory(): never {
        throw new Error("Access inventory commands inside unitOfWork.run");
      },
      run: (work) => self.run((scope) => work(scope.sales)),
    };
  }

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() =>
      this.db.transaction(async (tx) =>
        this.runOnTransaction(
          tx as InventoryDrizzle & PurchasingDrizzle & SalesDrizzle,
          work,
        ),
      ),
    );
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async runOnTransaction<T>(
    tx: InventoryDrizzle & PurchasingDrizzle & SalesDrizzle,
    work: (uow: IUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const resolveLocationUuid = async (locationId: LocationId): Promise<string> => {
      if (locationId === LocationId.DEFAULT) {
        return this.getDefaultLocationUuid();
      }
      const rows = await tx
        .select({ id: locations.id })
        .from(locations)
        .where(eq(locations.code, locationId))
        .limit(1);
      const id = rows[0]?.id;
      if (id === undefined) {
        throw new Error(`Unknown inventory location code ${locationId}`);
      }
      return id;
    };

    const readModel = new DrizzleInventoryReadModel(tx, resolveLocationUuid);
    const ledger = new DrizzleStockLedger(tx, readModel, resolveLocationUuid);
    const purchaseOrders = new DrizzlePurchaseOrderRepository(tx);
    const suppliers = new DrizzleSupplierRepository(tx);
    const salesOrders = new DrizzleSalesOrderRepository(tx);
    const purchasingInventoryCommands = new StockLedgerInventoryCommandAdapter(ledger);
    const salesInventoryCommands = new SalesStockLedgerInventoryCommandAdapter(ledger);

    const purchasingScope: IUnitOfWork["purchasing"] = {
      purchaseOrders,
      suppliers,
      inventory: purchasingInventoryCommands,
      run: (innerWork) => this.runOnTransaction(tx, (scope) => innerWork(scope.purchasing)),
    };

    const salesScope: IUnitOfWork["sales"] = {
      salesOrders,
      inventory: salesInventoryCommands,
      run: (innerWork) => this.runOnTransaction(tx, (scope) => innerWork(scope.sales)),
    };

    const scope: IUnitOfWork = {
      inventory: { ledger, readModel },
      purchasing: purchasingScope,
      sales: salesScope,
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }

  private getDefaultLocationUuid(): Promise<string> {
    if (this.defaultLocationUuid === null) {
      this.defaultLocationUuid = this.loadDefaultLocationUuid();
    }
    return this.defaultLocationUuid;
  }

  private async loadDefaultLocationUuid(): Promise<string> {
    const rows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.code, LocationId.DEFAULT))
      .limit(1);
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error("DEFAULT inventory location is missing; run Phase 2 bootstrap");
    }
    return id;
  }
}
