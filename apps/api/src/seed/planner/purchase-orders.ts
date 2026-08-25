import { PHASE1_PRODUCT_SKUS } from "../phase1-fixture.js";
import {
  DEMO_COUNTS,
  PO_LINE_COUNT_MAX,
  PO_LINE_COUNT_MEAN,
  PO_LINE_COUNT_MIN,
  PO_LINE_QTY_MAX,
  PO_LINE_QTY_MEAN,
  PO_LINE_QTY_MIN,
  type DemoCounts,
} from "./constants.js";
import {
  buildCorpusIntegers,
  mean,
  pickDistinct,
} from "./corpus-samplers.js";
import { addUtcDays, sampleHistoricalInstant, sampleLeftoverInstant } from "./dates.js";
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

function poLineProfile(counts: DemoCounts): {
  lineMin: number;
  lineMax: number;
  lineMean: number;
  qtyMin: number;
  qtyMax: number;
  qtyMean: number;
} {
  if (counts.purchaseOrders <= 20) {
    return {
      lineMin: 1,
      lineMax: 1,
      lineMean: 1,
      qtyMin: 24,
      qtyMax: 24,
      qtyMean: 24,
    };
  }
  return {
    lineMin: PO_LINE_COUNT_MIN,
    lineMax: PO_LINE_COUNT_MAX,
    lineMean: PO_LINE_COUNT_MEAN,
    qtyMin: PO_LINE_QTY_MIN,
    qtyMax: PO_LINE_QTY_MAX,
    qtyMean: PO_LINE_QTY_MEAN,
  };
}

export function planPurchaseOrders(input: {
  rng: SeededRandom;
  seedToday: Date;
  historicalStart: Date;
  suppliers: readonly PlannedSupplier[];
  supplierProducts: readonly PlannedSupplierProduct[];
  leftoverConfirmedCount: number;
  counts?: DemoCounts;
}): PlannedPurchaseOrder[] {
  const counts = input.counts ?? DEMO_COUNTS;
  const lineProfile = poLineProfile(counts);
  const receivedCount = counts.purchaseOrders - input.leftoverConfirmedCount;
  const lineCounts = buildCorpusIntegers(
    input.rng,
    counts.purchaseOrders,
    lineProfile.lineMin,
    lineProfile.lineMax,
    lineProfile.lineMean,
  );
  const totalLines = lineCounts.reduce((sum, value) => sum + value, 0);
  const lineQuantities = buildCorpusIntegers(
    input.rng,
    totalLines,
    lineProfile.qtyMin,
    lineProfile.qtyMax,
    lineProfile.qtyMean,
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
        counts.leftoverWindowDays,
      ),
      status: "leftoverConfirmed",
      lines,
    });
  }

  if (counts.purchaseOrders <= 20) {
    const generatedSkus = [
      ...new Set(
        input.supplierProducts
          .map((row) => row.sku)
          .filter(
            (sku) =>
              !PHASE1_PRODUCT_SKUS.includes(sku as (typeof PHASE1_PRODUCT_SKUS)[number]),
          ),
      ),
    ].sort((left, right) => left.localeCompare(right));
    const receivedOrders = orders.filter((row) => row.status === "received");
    for (const [index, order] of receivedOrders.entries()) {
      const line = order.lines[0];
      if (line === undefined) {
        throw new Error(`reduced received PO ${order.key} is missing a line`);
      }
      const phase1Sku = PHASE1_PRODUCT_SKUS[index];
      if (phase1Sku !== undefined) {
        line.sku = phase1Sku;
        order.supplierKey = vend001.key;
        phase1Coverage.add(phase1Sku);
        continue;
      }
      const offset = index - PHASE1_PRODUCT_SKUS.length;
      const sku = generatedSkus[offset % generatedSkus.length];
      if (sku === undefined) {
        throw new Error("reduced received PO is missing a generated SKU");
      }
      const supplierProduct = input.supplierProducts.find((row) => row.sku === sku);
      if (supplierProduct === undefined) {
        throw new Error(`missing supplier product for ${sku}`);
      }
      line.sku = sku;
      order.supplierKey = supplierProduct.supplierKey;
      phase1Coverage.add(sku);
    }
    for (const [index, order] of receivedOrders.entries()) {
      order.plannedInstant = addUtcDays(
        input.seedToday,
        -(200 + (receivedOrders.length - index)),
      );
    }
  }

  if (counts.purchaseOrders > 20) {
    for (const sku of PHASE1_PRODUCT_SKUS) {
      if (!phase1Coverage.has(sku)) {
        throw new Error(`Phase 1 SKU ${sku} missing from received PO plan`);
      }
    }
  }

  if (Math.abs(mean(lineCounts) - lineProfile.lineMean) > 1e-9) {
    throw new Error(`PO line corpus mean ${String(mean(lineCounts))}, expected ${String(lineProfile.lineMean)}`);
  }
  if (Math.abs(mean(lineQuantities) - lineProfile.qtyMean) > 1e-9) {
    throw new Error(`PO qty corpus mean ${String(mean(lineQuantities))}, expected ${String(lineProfile.qtyMean)}`);
  }
  for (const order of orders) {
    const uniqueSkus = new Set(order.lines.map((line) => line.sku));
    if (uniqueSkus.size !== order.lines.length) {
      throw new Error(`${order.key} repeats a SKU on one document`);
    }
  }

  return orders;
}

export function chooseLeftoverPurchaseOrderCount(
  rng: SeededRandom,
  counts: DemoCounts = DEMO_COUNTS,
): number {
  return rng.int(counts.leftoverConfirmedPurchaseOrderMin, counts.leftoverConfirmedPurchaseOrderMax);
}
