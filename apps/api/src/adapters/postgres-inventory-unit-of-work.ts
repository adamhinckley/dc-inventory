import type { IClock } from "@dc-inventory/inventory";
import type { AppDrizzle } from "../infrastructure/db.js";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import {
  DrizzleInventoryReadModel,
  DrizzleSellWindowRepository,
  DrizzleStockLedger,
  type InventoryDrizzle,
  type SellWindowDrizzle,
} from "@dc-inventory/inventory";
import {
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierRepository,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import {
  DrizzleInvoiceRepository,
  type AccountingDrizzle,
  type ICustomerBillToSnapshotReadPort,
  type ICustomerTermsReadPort,
} from "@dc-inventory/accounting";
import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import { locations } from "@dc-inventory/inventory/schema";
import {
  DrizzleSalesOrderRepository,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import { StockLedgerInventoryCommandAdapter } from "./inventory-command-port.js";
import { SalesInvoiceAccountingCommandAdapter } from "./sales-accounting-command-port.js";
import {
  INVENTORY_IDEMPOTENCY_CONSTRAINTS,
  retryAfterIdempotencyRace,
} from "./postgres-idempotency-race.js";

/**
 * Postgres-backed unit of work for the composition root.
 * Each callback runs in its own Drizzle transaction. Inventory adapters use
 * row-level locks for the snapshot rows touched by that transaction.
 */
export class PostgresInventoryUnitOfWork implements IUnitOfWork {
  private readonly defaultLocationUuidByOrg = new Map<string, Promise<string>>();
  readonly inventory: IUnitOfWork["inventory"];
  private readonly billToSnapshot: ICustomerBillToSnapshotReadPort;
  private readonly customerTerms: ICustomerTermsReadPort;

  constructor(
    private readonly db: AppDrizzle,
    private readonly clock: IClock,
    billToSnapshot: ICustomerBillToSnapshotReadPort,
    customerTerms: ICustomerTermsReadPort,
  ) {
    this.billToSnapshot = billToSnapshot;
    this.customerTerms = customerTerms;
    this.inventory = {
      ledger: null as unknown as DrizzleStockLedger,
      readModel: new DrizzleInventoryReadModel(
        db,
        (organizationId, locationId) =>
          this.resolveLocationUuid(this.db, organizationId, locationId),
        clock,
      ),
    };
  }

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
      get accounting(): never {
        throw new Error("Access accounting commands inside unitOfWork.run");
      },
      run: (work) => self.run((scope) => work(scope.sales)),
    };
  }

  run<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T> {
    return retryAfterIdempotencyRace(
      () =>
        this.db.transaction(async (tx) =>
          this.runOnTransaction(
            tx as unknown as InventoryDrizzle &
              PurchasingDrizzle &
              SalesDrizzle &
              AccountingDrizzle,
            work,
          ),
        ),
      INVENTORY_IDEMPOTENCY_CONSTRAINTS,
    );
  }

  private async runOnTransaction<T>(
    tx: InventoryDrizzle & PurchasingDrizzle & SalesDrizzle & AccountingDrizzle,
    work: (uow: IUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const resolveLocationUuid = (
      organizationId: OrganizationId,
      locationId: LocationId,
    ): Promise<string> => this.resolveLocationUuid(tx, organizationId, locationId);

    const readModel = new DrizzleInventoryReadModel(tx, resolveLocationUuid, this.clock);
    const ledger = new DrizzleStockLedger(tx, readModel, resolveLocationUuid, this.clock);
    const sellWindows = new DrizzleSellWindowRepository(tx as unknown as SellWindowDrizzle, {
      wrapCreateInTransaction: false,
    });
    const purchaseOrders = new DrizzlePurchaseOrderRepository(tx);
    const suppliers = new DrizzleSupplierRepository(tx);
    const salesOrders = new DrizzleSalesOrderRepository(tx);
    const invoices = new DrizzleInvoiceRepository(tx);
    const inventoryCommands = new StockLedgerInventoryCommandAdapter(ledger, readModel);
    const salesAccountingCommands = new SalesInvoiceAccountingCommandAdapter(
      invoices,
      this.billToSnapshot,
      this.customerTerms,
      this.clock,
    );

    const purchasingScope: IUnitOfWork["purchasing"] = {
      purchaseOrders,
      suppliers,
      inventory: inventoryCommands,
      run: (innerWork) => this.runOnTransaction(tx, (scope) => innerWork(scope.purchasing)),
    };

    const salesScope: IUnitOfWork["sales"] = {
      salesOrders,
      inventory: inventoryCommands,
      accounting: salesAccountingCommands,
      run: (innerWork) => this.runOnTransaction(tx, (scope) => innerWork(scope.sales)),
    };

    const scope: IUnitOfWork = {
      inventory: { ledger, readModel, sellWindows },
      purchasing: purchasingScope,
      sales: salesScope,
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }

  private async resolveLocationUuid(
    db: Pick<AppDrizzle, "select">,
    organizationId: OrganizationId,
    locationId: LocationId,
  ): Promise<string> {
    if (locationId === LocationId.DEFAULT) {
      return this.getDefaultLocationUuid(organizationId);
    }
    const rows = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, locationId),
        ),
      )
      .limit(1);
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error(`Unknown inventory location code ${locationId}`);
    }
    return id;
  }

  private getDefaultLocationUuid(organizationId: OrganizationId): Promise<string> {
    const cached = this.defaultLocationUuidByOrg.get(organizationId);
    if (cached !== undefined) {
      return cached;
    }
    const loaded = this.loadDefaultLocationUuid(organizationId);
    this.defaultLocationUuidByOrg.set(organizationId, loaded);
    return loaded;
  }

  private async loadDefaultLocationUuid(organizationId: OrganizationId): Promise<string> {
    const rows = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.code, LocationId.DEFAULT),
        ),
      )
      .limit(1);
    const id = rows[0]?.id;
    if (id === undefined) {
      throw new Error("DEFAULT inventory location is missing; run Phase 2 bootstrap");
    }
    return id;
  }
}
