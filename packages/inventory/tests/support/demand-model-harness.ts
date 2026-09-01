import { LocationId, OrganizationId } from "@dc-inventory/shared-kernel";
import type { Sku } from "@dc-inventory/shared-kernel";
import { InMemoryClock } from "../../src/adapters/in-memory-clock.js";
import { InMemoryInventoryUnitOfWork } from "../../src/adapters/in-memory-inventory-unit-of-work.js";
import { GetStockSnapshotUseCase } from "../../src/application/get-stock-snapshot.js";
import { RecordAdjustmentIncreaseUseCase } from "../../src/application/record-adjustment-increase.js";
import { RecordAllocatedUseCase } from "../../src/application/record-allocated.js";
import { RecordDeallocatedUseCase } from "../../src/application/record-deallocated.js";
import { RecordGoodsReceivedUseCase } from "../../src/application/record-goods-received.js";
import { RecordInboundCancelledUseCase } from "../../src/application/record-inbound-cancelled.js";
import { RecordInboundFromPoUseCase } from "../../src/application/record-inbound-from-po.js";
import { RecordShippedUseCase } from "../../src/application/record-shipped.js";
import type { IClock } from "../../src/domain/clock.js";
import type {
  IStockLedger,
  StockCommandResult,
  StockSnapshotLock,
} from "../../src/domain/ports/stock-ledger.js";
import type { StockFigures } from "../../src/domain/snapshot.js";
import {
  isDemandStockFigures,
  type DemandCommandResult,
  type DemandSalesOrderCommand,
  type DemandStockFigures,
  type ReopenSkusForPresellCommand,
  type SetSellWindowCommand,
} from "./demand-model-api.js";

type ExtendedStockLedger = IStockLedger & {
  recordCommitted?(command: DemandSalesOrderCommand): Promise<StockCommandResult>;
  recordDecommitted?(command: DemandSalesOrderCommand): Promise<StockCommandResult>;
  reopenSkusForPresell?(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult>;
  setSellWindow?(command: SetSellWindowCommand): Promise<DemandCommandResult>;
};

function notImplemented(): DemandCommandResult {
  return { ok: false, reason: "demand_model_not_implemented" };
}

function toDemandResult(result: StockCommandResult): DemandCommandResult {
  if (result.ok) {
    return { ok: true };
  }
  return { ok: false, reason: result.reason };
}

function snapshotLock(
  organizationId: OrganizationId,
  sku: Sku,
  locationId: LocationId = LocationId.DEFAULT,
): StockSnapshotLock {
  return { organizationId, sku, locationId };
}

export type DemandModelHarness = ReturnType<typeof demandModelHarness>;

export function demandModelHarness(
  clockInput: IClock | Date = new Date("2026-06-15T12:00:00.000Z"),
) {
  const clock = clockInput instanceof Date ? new InMemoryClock(clockInput) : clockInput;
  const uow = new InMemoryInventoryUnitOfWork(clock);
  const ledger = uow.ledger as ExtendedStockLedger;

  const getSnapshot = new GetStockSnapshotUseCase(uow.readModel);

  async function demandSnapshot(
    sku: Sku,
    organizationId: OrganizationId = OrganizationId.DEFAULT,
    locationId: LocationId = LocationId.DEFAULT,
  ): Promise<DemandStockFigures> {
    const snapshot = await getSnapshot.execute({ organizationId, sku, locationId });
    if (!isDemandStockFigures(snapshot)) {
      throw new Error("Demand snapshot fields are not implemented on the read model");
    }
    return snapshot;
  }

  async function withLockedSnapshot<T>(
    locks: readonly StockSnapshotLock[],
    work: (scope: ExtendedStockLedger) => Promise<T>,
  ): Promise<T> {
    return uow.run(async (scope) => {
      await scope.ledger.lockSnapshots(locks);
      return work(scope.ledger as ExtendedStockLedger);
    });
  }

  return {
    clock,
    uow,
    readModel: uow.readModel,
    getSnapshot,
    demandSnapshot,
    inboundFromPo: new RecordInboundFromPoUseCase(ledger),
    goodsReceived: new RecordGoodsReceivedUseCase(ledger),
    inboundCancelled: new RecordInboundCancelledUseCase(ledger),
    allocated: new RecordAllocatedUseCase(ledger),
    deallocated: new RecordDeallocatedUseCase(ledger),
    shipped: new RecordShippedUseCase(ledger),
    adjustmentIncrease: new RecordAdjustmentIncreaseUseCase(ledger),

    async committed(
      command: DemandSalesOrderCommand,
    ): Promise<DemandCommandResult> {
      return withLockedSnapshot([snapshotLock(command.organizationId, command.sku, command.locationId)], async (scopedLedger) => {
        if (!scopedLedger.recordCommitted) {
          return notImplemented();
        }
        return toDemandResult(await scopedLedger.recordCommitted(command));
      });
    },

    async decommitted(
      command: DemandSalesOrderCommand,
    ): Promise<DemandCommandResult> {
      return withLockedSnapshot([snapshotLock(command.organizationId, command.sku, command.locationId)], async (scopedLedger) => {
        if (!scopedLedger.recordDecommitted) {
          return notImplemented();
        }
        return toDemandResult(await scopedLedger.recordDecommitted(command));
      });
    },

    async reopenSkusForPresell(command: ReopenSkusForPresellCommand): Promise<DemandCommandResult> {
      if (!ledger.reopenSkusForPresell) {
        return notImplemented();
      }
      return ledger.reopenSkusForPresell(command);
    },

    async setSellWindow(command: SetSellWindowCommand): Promise<DemandCommandResult> {
      if (!ledger.setSellWindow) {
        return notImplemented();
      }
      return ledger.setSellWindow(command);
    },

    async baseSnapshot(
      sku: Sku,
      organizationId: OrganizationId = OrganizationId.DEFAULT,
      locationId: LocationId = LocationId.DEFAULT,
    ): Promise<StockFigures> {
      return getSnapshot.execute({ organizationId, sku, locationId });
    },
  };
}
