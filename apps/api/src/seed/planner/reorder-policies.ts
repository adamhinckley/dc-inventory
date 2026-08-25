import { isDemoLowStock } from "../reconciliation/assert-demo-book.js";
import { createSeededRandom } from "./seeded-random.js";

export type PlannedReorderPolicy = {
  sku: string;
  minOnHand: number;
  maxOnHand: number;
};

export type PlanDemoReorderPoliciesInput = {
  seed: string;
  skus: readonly string[];
  onHandBySku: ReadonlyMap<string, number>;
  lowStockMin: number;
  lowStockMax: number;
};

function countLowStock(
  skus: readonly string[],
  onHandBySku: ReadonlyMap<string, number>,
  minBySku: ReadonlyMap<string, number>,
): { lowCount: number; naturalZeros: number } {
  let lowCount = 0;
  let naturalZeros = 0;
  for (const sku of skus) {
    const onHand = onHandBySku.get(sku) ?? 0;
    const minOnHand = minBySku.get(sku) ?? 0;
    if (onHand === 0) {
      naturalZeros += 1;
    }
    if (isDemoLowStock(onHand, minOnHand)) {
      lowCount += 1;
    }
  }
  return { lowCount, naturalZeros };
}

/**
 * Deterministic reorder policy planner for the Demo book. Uses final on-hand only;
 * never mutates stock to hit the low-stock band.
 */
export function planDemoReorderPolicies(
  input: PlanDemoReorderPoliciesInput,
): PlannedReorderPolicy[] {
  const minBySku = new Map<string, number>();
  for (const sku of input.skus) {
    minBySku.set(sku, 0);
  }

  let { lowCount, naturalZeros } = countLowStock(input.skus, input.onHandBySku, minBySku);

  const needsRaise =
    naturalZeros > input.lowStockMax
      ? lowCount < input.lowStockMin
      : lowCount < input.lowStockMin;

  if (needsRaise) {
    const positiveSkus = input.skus.filter((sku) => (input.onHandBySku.get(sku) ?? 0) > 0);
    const rng = createSeededRandom(`${input.seed}:reorder-policies`);
    const shuffled = rng.shuffle(positiveSkus);
    const needed = input.lowStockMin - lowCount;

    for (let index = 0; index < needed && index < shuffled.length; index += 1) {
      const sku = shuffled[index];
      if (sku === undefined) {
        break;
      }
      const onHand = input.onHandBySku.get(sku) ?? 0;
      minBySku.set(sku, onHand + 1);
      lowCount += 1;
    }
  }

  return input.skus.map((sku) => {
    const onHand = input.onHandBySku.get(sku) ?? 0;
    const minOnHand = minBySku.get(sku) ?? 0;
    return {
      sku,
      minOnHand,
      maxOnHand: Math.max(minOnHand + 12, onHand),
    };
  });
}
