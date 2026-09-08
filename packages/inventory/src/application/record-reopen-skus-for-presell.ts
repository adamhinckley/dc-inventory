import type { OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { isSellWindowInvalid, isSellWindowOpenInThePast } from "../domain/demand-model.js";
import type { IStockLedger } from "../domain/ports/stock-ledger.js";
import type { SellWindow, SellWindowFilterSnapshot } from "../domain/sell-window.js";
import { CreateSellWindowUseCase } from "./create-sell-window.js";

export type RecordReopenSkusForPresellRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  name: string;
  filterSnapshot: SellWindowFilterSnapshot;
  skus: readonly Sku[];
  windowOpensAt?: Date | null;
  windowClosesAt: Date;
};

export type RecordReopenSkusForPresellResult =
  | { ok: true; reopenedCount: number; sellWindow: SellWindow }
  | { ok: false; reason: "invalid" | "invalid_sell_window" };

export class SellWindowPersistenceError extends Error {
  constructor(public readonly reason: "invalid" | "invalid_sell_window") {
    super(`sell window persistence failed: ${reason}`);
    this.name = "SellWindowPersistenceError";
  }
}

export class RecordReopenSkusForPresellUseCase {
  constructor(
    private readonly ledger: IStockLedger,
    private readonly createSellWindow: CreateSellWindowUseCase,
    private readonly clock: IClock,
  ) {}

  async execute(
    input: RecordReopenSkusForPresellRequest,
  ): Promise<RecordReopenSkusForPresellResult> {
    const name = input.name.trim();
    const uniqueSkus = [...new Map(input.skus.map((sku) => [sku.value, sku])).values()];
    if (name.length === 0 || uniqueSkus.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const windowOpensAt = input.windowOpensAt ?? null;
    if (
      isSellWindowInvalid(windowOpensAt, input.windowClosesAt) ||
      isSellWindowOpenInThePast(windowOpensAt, this.clock.now())
    ) {
      return { ok: false, reason: "invalid_sell_window" };
    }

    const reopenResult = await this.ledger.reopenSkusForPresell({
      organizationId: input.organizationId,
      skus: uniqueSkus,
      windowOpensAt,
      windowClosesAt: input.windowClosesAt,
    });
    if (!reopenResult.ok) {
      if (reopenResult.reason === "invalid_sell_window") {
        return { ok: false, reason: "invalid_sell_window" };
      }
      return { ok: false, reason: "invalid" };
    }

    const created = await this.createSellWindow.execute({
      organizationId: input.organizationId,
      staffUserId: input.staffUserId,
      name,
      filterSnapshot: input.filterSnapshot,
      windowOpensAt,
      windowClosesAt: input.windowClosesAt,
      skus: uniqueSkus,
    });
    if (!created.ok) {
      throw new SellWindowPersistenceError(created.reason);
    }

    return {
      ok: true,
      reopenedCount: uniqueSkus.length,
      sellWindow: created.window,
    };
  }
}
