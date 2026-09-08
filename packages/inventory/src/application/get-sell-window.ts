import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import type { SellWindowId } from "../domain/ids.js";
import { projectLiveSellWindowStatus } from "../domain/sell-window.js";
import type {
  ISellWindowRepository,
  SellWindowDetail,
} from "../domain/ports/sell-window-repository.js";

export type GetSellWindowRequest = {
  organizationId: OrganizationId;
  id: SellWindowId;
};

export type GetSellWindowResult =
  | { ok: true; window: SellWindowDetail }
  | { ok: false; reason: "not_found" };

export class GetSellWindowUseCase {
  constructor(
    private readonly sellWindows: ISellWindowRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: GetSellWindowRequest): Promise<GetSellWindowResult> {
    const window = await this.sellWindows.findById(input.organizationId, input.id);
    if (window === null) {
      return { ok: false, reason: "not_found" };
    }
    return {
      ok: true,
      window: projectLiveSellWindowStatus(window, this.clock.now()),
    };
  }
}
