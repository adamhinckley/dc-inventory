import { PHASE1_PRODUCT_SKUS } from "../phase1-fixture.js";
import { FULL_DEMO_RECONCILIATION_EXPECTATIONS } from "../reconciliation/expectations.js";
import {
  DEMO_COUNTS,
  PO_LINE_COUNT_MAX,
  PO_LINE_COUNT_MEAN,
  PO_LINE_COUNT_MIN,
  PO_LINE_QTY_MAX,
  PO_LINE_QTY_MEAN,
  PO_LINE_QTY_MIN,
} from "./constants.js";
import {
  buildCorpusIntegers,
  mean,
  pickDistinct,
} from "./corpus-samplers.js";
import { sampleHistoricalInstant, sampleLeftoverInstant } from "./dates.js";
import type { SeededRandom } from "./seeded-random.js";
import type {
  PlannedProduct,
  PlannedPurchaseOrder,
  PlannedSupplier,
  PlannedSupplierProduct,
} from "./types.js";

function skusForSupplier(
  supplierKey: string,
  supplierProducts: readonly PlannedSupplierProduct[],
): string[] {
  return supplierProducts.filter((row) => row.supplierKey === supplierKey).map((row) => row.sku);
}

export function planPurchaseOrders(input: {
  rng: SeededRandom;
  seedToday: Date;
  historicalStart: Date;
  suppliers: readonly PlannedSupplier[];
  supplierProducts: readonly PlannedSupplierProduct[];
  leftoverConfirmedCount: number;
}): PlannedPurchaseOrder[] {
  const receivedCount = DEMO_COUNTS.purchaseOrders - input.leftoverConfirmedCount;
  const lineCounts = buildCorpusIntegers(
    input.rng,
    DEMO_COUNTS.purchaseOrders,
    PO_LINE_COUNT_MIN,
    PO_LINE_COUNT_MAX,
    PO_LINE_COUNT_MEAN,
  );
  const totalLines = lineCounts.reduce((sum, value) => sum + value, 0);
  const lineQuantities = buildCorpusIntegers(
    input.rng,
    totalLines,
    PO_LINE_QTY_MIN,
    PO_LINE_QTY_MAX,
    PO_LINE_QTY_MEAN,
  );

  const orders: PlannedPurchaseOrder[] = [];
  let quantityCursor = 0;
  const phase1Coverage = new Set<string>();

  const vend001 = input.suppliers.find((row) => row.key === "vend-001");
  if (!vend001) {
    throw new Error("missing VEND-001 supplier");
  }

  for (let index = 0; index < receivedCount; index += 1) {
    const phase1Sku = index < PHASE1_PRODUCT_SKUS.length ? PHASE1_PRODUCT_SKUS[index] : undefined;
    const supplier = phase1Sku !== undefined ? vend001 : input.rng.pick(input.suppliers);
    const supplierSkus = skusForSupplier(supplier.key, input.supplierProducts);
    const lineCount = lineCounts[index];
    if (lineCount === undefined) {
      throw new Error("missing PO line count");
    }
    let chosenSkus =
      phase1Sku !== undefined
        ? lineCount === 1
          ? [phase1Sku]
          : [
              phase1Sku,
              ...pickDistinct(
                input.rng,
                supplierSkus.filter((sku) => sku !== phase1Sku),
                lineCount - 1,
              ),
            ]
        : pickDistinct(input.rng, supplierSkus, lineCount);
    const lines = chosenSkus.map((sku) => {
      const qty = lineQuantities[quantityCursor];
      quantityCursor += 1;
      if (qty === undefined) {
        throw new Error("missing PO line quantity");
      }
      phase1Coverage.add(sku);
      return { sku, qty };
    });
    orders.push({
      key: `po-${String(index + 1).padStart(5, "0")}`,
      supplierKey: supplier.key,
      plannedInstant: sampleHistoricalInstant(
        input.rng,
        input.historicalStart,
        input.seedToday,
        { seedToday: input.seedToday },
      ),
      status: "received",
      lines,
    });
  }

  for (let index = 0; index < input.leftoverConfirmedCount; index += 1) {
    const orderIndex = receivedCount + index;
    const supplier = input.rng.pick(input.suppliers);
    const supplierSkus = skusForSupplier(supplier.key, input.supplierProducts);
    const lineCount = lineCounts[orderIndex];
    if (lineCount === undefined) {
      throw new Error("missing leftover PO line count");
    }
    const chosenSkus = pickDistinct(input.rng, supplierSkus, lineCount);
    const lines = chosenSkus.map((sku) => {
      const qty = lineQuantities[quantityCursor];
      quantityCursor += 1;
      if (qty === undefined) {
        throw new Error("missing leftover PO line quantity");
      }
      return { sku, qty };
    });
    orders.push({
      key: `po-${String(orderIndex + 1).padStart(5, "0")}`,
      supplierKey: supplier.key,
      plannedInstant: sampleLeftoverInstant(
        input.rng,
        input.seedToday,
        FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverWindowDays,
      ),
      status: "leftoverConfirmed",
      lines,
    });
  }

  for (const sku of PHASE1_PRODUCT_SKUS) {
    if (!phase1Coverage.has(sku)) {
      throw new Error(`Phase 1 SKU ${sku} missing from received PO plan`);
    }
  }

  if (Math.abs(mean(lineCounts) - PO_LINE_COUNT_MEAN) > 1e-9) {
    throw new Error(`PO line corpus mean ${String(mean(lineCounts))}, expected ${String(PO_LINE_COUNT_MEAN)}`);
  }
  if (Math.abs(mean(lineQuantities) - PO_LINE_QTY_MEAN) > 1e-9) {
    throw new Error(`PO qty corpus mean ${String(mean(lineQuantities))}, expected ${String(PO_LINE_QTY_MEAN)}`);
  }
  for (const order of orders) {
    const uniqueSkus = new Set(order.lines.map((line) => line.sku));
    if (uniqueSkus.size !== order.lines.length) {
      throw new Error(`${order.key} repeats a SKU on one document`);
    }
  }

  return orders;
}

export function chooseLeftoverPurchaseOrderCount(rng: SeededRandom): number {
  return rng.int(
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMin,
    FULL_DEMO_RECONCILIATION_EXPECTATIONS.leftoverConfirmedPurchaseOrderMax,
  );
}
