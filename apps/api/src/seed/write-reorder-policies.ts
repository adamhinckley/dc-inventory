import type { IProductRepository } from "@dc-inventory/catalog";
import type { IInventoryReadModel } from "@dc-inventory/inventory";
import { LocationId } from "@dc-inventory/shared-kernel";
import { planDemoReorderPolicies } from "./planner/reorder-policies.js";
import type { DemoBookPlan } from "./planner/types.js";
import type { IReorderPolicySeedRepository } from "./ports/static-seed-types.js";
import {
  FULL_DEMO_RECONCILIATION_EXPECTATIONS,
  type DemoReconciliationExpectations,
} from "./reconciliation/expectations.js";

export class WriteReorderPoliciesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WriteReorderPoliciesError";
  }
}

export type WriteReorderPoliciesPorts = {
  products: Pick<IProductRepository, "listMatching">;
  inventoryReadModel: IInventoryReadModel;
  reorderPolicies: IReorderPolicySeedRepository;
};

export type WriteReorderPoliciesInput = {
  plan: DemoBookPlan;
  locationId: LocationId;
  expectations?: Pick<DemoReconciliationExpectations, "lowStockMin" | "lowStockMax">;
};

export type WriteReorderPoliciesResult = {
  policyCount: number;
};

export async function runWriteReorderPolicies(
  ports: WriteReorderPoliciesPorts,
  input: WriteReorderPoliciesInput,
): Promise<WriteReorderPoliciesResult> {
  const listed = await ports.products.listMatching({ shopVisibleOnly: true });
  const skus = listed
    .map((row) => row.product.sku.value)
    .sort((left, right) => left.localeCompare(right));

  const onHandBySku = new Map<string, number>();
  for (const row of listed) {
    const snapshot = await ports.inventoryReadModel.getSnapshot(
      row.product.sku,
      input.locationId,
    );
    onHandBySku.set(row.product.sku.value, snapshot.onHand);
  }

  const expectations = input.expectations ?? FULL_DEMO_RECONCILIATION_EXPECTATIONS;
  const planned = planDemoReorderPolicies({
    seed: input.plan.seed,
    skus,
    onHandBySku,
    lowStockMin: expectations.lowStockMin,
    lowStockMax: expectations.lowStockMax,
  });

  for (const policy of planned) {
    await ports.reorderPolicies.save({
      sku: policy.sku,
      locationId: input.locationId,
      minOnHand: policy.minOnHand,
      maxOnHand: policy.maxOnHand,
    });
  }

  return { policyCount: planned.length };
}
