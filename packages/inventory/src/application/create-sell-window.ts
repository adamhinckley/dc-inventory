import {
  OrganizationId,
  StaffUserId,
  type OrganizationId as OrganizationIdType,
  type Sku,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { SellWindowId, newUuid } from "../domain/ids.js";
import { isSellWindowInvalid } from "../domain/demand-model.js";
import {
  computeSellWindowStatus,
  type SellWindow,
  type SellWindowFilterSnapshot,
} from "../domain/sell-window.js";
import type {
  CreateSellWindowRecord,
  ISellWindowRepository,
} from "../domain/ports/sell-window-repository.js";
import { normalizeSellWindowFilterSnapshot } from "../domain/ports/sell-window-repository.js";

export type CreateSellWindowRequest = {
  organizationId: OrganizationIdType;
  staffUserId: StaffUserId;
  name: string;
  filterSnapshot: SellWindowFilterSnapshot;
  windowOpensAt?: Date | null;
  windowClosesAt: Date;
  skus: readonly Sku[];
};

export type CreateSellWindowResult =
  | { ok: true; window: SellWindow }
  | { ok: false; reason: "invalid" | "invalid_sell_window" };

export class CreateSellWindowUseCase {
  constructor(
    private readonly sellWindows: ISellWindowRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: CreateSellWindowRequest): Promise<CreateSellWindowResult> {
    const name = input.name.trim();
    const uniqueSkus = [...new Map(input.skus.map((sku) => [sku.value, sku])).values()];
    if (name.length === 0 || uniqueSkus.length === 0) {
      return { ok: false, reason: "invalid" };
    }
    const windowOpensAt = input.windowOpensAt ?? null;
    if (isSellWindowInvalid(windowOpensAt, input.windowClosesAt)) {
      return { ok: false, reason: "invalid_sell_window" };
    }
    const now = this.clock.now();
    const filterSnapshot = normalizeSellWindowFilterSnapshot(input.filterSnapshot);
    const window: SellWindow = {
      id: SellWindowId.parse(newUuid()),
      organizationId: OrganizationId.parse(input.organizationId),
      name,
      filterSnapshot,
      windowOpensAt,
      windowClosesAt: input.windowClosesAt,
      status: computeSellWindowStatus(
        {
          windowOpensAt,
          windowClosesAt: input.windowClosesAt,
          manuallyClosedAt: null,
        },
        now,
      ),
      manuallyClosedAt: null,
      appliedBy: StaffUserId.parse(input.staffUserId),
      appliedAt: now,
      skuCount: uniqueSkus.length,
      createdAt: now,
      updatedAt: now,
    };
    const record: CreateSellWindowRecord = {
      window,
      skus: uniqueSkus,
    };
    await this.sellWindows.create(record);
    return { ok: true, window };
  }
}
