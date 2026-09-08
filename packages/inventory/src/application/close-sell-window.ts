import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { SellWindowId } from "../domain/ids.js";
import type { SellWindow } from "../domain/sell-window.js";
import type { ISellWindowRepository } from "../domain/ports/sell-window-repository.js";

export type CloseSellWindowRequest = {
  organizationId: OrganizationId;
  id: SellWindowId;
};

export type CloseSellWindowResult =
  | { ok: true; window: SellWindow }
  | { ok: false; reason: "not_found" | "already_closed" };

export class CloseSellWindowUseCase {
  constructor(
    private readonly sellWindows: ISellWindowRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: CloseSellWindowRequest): Promise<CloseSellWindowResult> {
    const existing = await this.sellWindows.findById(input.organizationId, input.id);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    if (existing.manuallyClosedAt !== null || existing.status === "closed") {
      return { ok: false, reason: "already_closed" };
    }
    const closed = await this.sellWindows.close(
      input.organizationId,
      input.id,
      this.clock.now(),
    );
    if (closed === null) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, window: closed };
  }
}
