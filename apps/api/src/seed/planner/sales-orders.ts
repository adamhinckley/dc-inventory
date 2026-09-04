import { PHASE1_PRODUCT_SKUS } from "../phase1-fixture.js";
import { utcDayDiff, demoArBucket } from "../reconciliation/assert-demo-book.js";
import {
  DEMO_COUNTS,
  HARVEST_Q4_SHIPPED_FRACTION,
  IDLE_PARK_DORMANCY_DAYS,
  PERSONA_ORDER_BUDGETS,
  SO_LINE_COUNT_DEFAULT_MAX,
  SO_LINE_COUNT_DEFAULT_MEAN,
  SO_LINE_COUNT_DEFAULT_MIN,
  SO_LINE_COUNT_IDLE_PARK_MAX,
  SO_LINE_COUNT_IDLE_PARK_MIN,
  SO_LINE_COUNT_NORTHSTAR_MAX,
  SO_LINE_COUNT_NORTHSTAR_MIN,
  SO_LINE_QTY_MAX,
  SO_LINE_QTY_MEAN,
  SO_LINE_QTY_MIN,
  type DemoCounts,
  type PersonaOrderBudgets,
} from "./constants.js";
import {
  allocateExactCounts,
  buildCorpusIntegers,
  mean,
  pickDistinct,
} from "./corpus-samplers.js";
import {
  addUtcDays,
  isQ4Month,
  isWithinLastDays,
  sampleHistoricalInstant,
  sampleLeftoverInstant,
} from "./dates.js";
import type { SeededRandom } from "./seeded-random.js";
import type {
  PlannedCustomer,
  PlannedProduct,
  PlannedSalesOrder,
  PlannedShipTo,
} from "./types.js";

type CustomerOrderCounts = Map<string, number>;

function buildCustomerLineCounts(
  rng: SeededRandom,
  customer: PlannedCustomer,
  orderCount: number,
  counts: DemoCounts,
): number[] {
  if (orderCount === 0) {
    return [];
  }
  if (counts.salesOrders <= 20) {
    return Array.from({ length: orderCount }, () => 1);
  }
  if (customer.persona === "northstar") {
    return Array.from({ length: orderCount }, () =>
      rng.int(SO_LINE_COUNT_NORTHSTAR_MIN, SO_LINE_COUNT_NORTHSTAR_MAX),
    );
  }
  if (customer.persona === "idlePark") {
    return Array.from({ length: orderCount }, () =>
      rng.int(SO_LINE_COUNT_IDLE_PARK_MIN, SO_LINE_COUNT_IDLE_PARK_MAX),
    );
  }
  return buildCorpusIntegers(
    rng,
    orderCount,
    SO_LINE_COUNT_DEFAULT_MIN,
    SO_LINE_COUNT_DEFAULT_MAX,
    SO_LINE_COUNT_DEFAULT_MEAN,
  );
}

function allocateCustomerOrderCounts(
  rng: SeededRandom,
  customers: readonly PlannedCustomer[],
  counts: DemoCounts,
  personaOrderBudgets: PersonaOrderBudgets,
): CustomerOrderCounts {
  const orderCounts = new Map<string, number>();
  orderCounts.set("northstar", personaOrderBudgets.northstar);
  orderCounts.set("harvest", personaOrderBudgets.harvest);
  orderCounts.set("idlePark", personaOrderBudgets.idlePark);

  const remainderKeys = customers
    .filter((row) => row.persona === "acme" || row.persona === "mix")
    .map((row) => row.key);
  const remainder =
    counts.salesOrders -
    personaOrderBudgets.northstar -
    personaOrderBudgets.harvest -
    personaOrderBudgets.idlePark;
  const allocated = allocateExactCounts(rng, remainderKeys, remainder);
  for (const [key, value] of allocated.entries()) {
    orderCounts.set(key, value);
  }

  const total = [...orderCounts.values()].reduce((sum, value) => sum + value, 0);
  if (total !== counts.salesOrders) {
    throw new Error(`sales order budget total ${String(total)}`);
  }
  return orderCounts;
}

function assignLeftoverCounts(
  rng: SeededRandom,
  customers: readonly PlannedCustomer[],
  orderCounts: CustomerOrderCounts,
  leftoverConfirmedCount: number,
  counts: DemoCounts,
): Map<string, { confirmed: number; draft: number }> {
  const leftoverDraftTotal =
    counts.salesOrders - counts.shippedSalesOrders - leftoverConfirmedCount;
  const result = new Map<string, { confirmed: number; draft: number }>(
    customers.map((row) => [row.key, { confirmed: 0, draft: 0 }]),
  );

  const acme = result.get("acme");
  if (!acme) {
    throw new Error("acme missing from leftover allocation");
  }
  acme.draft = 1;
  let draftRemaining = leftoverDraftTotal - 1;
  let confirmedRemaining = leftoverConfirmedCount;

  const eligible = customers
    .filter((row) => row.persona !== "idlePark")
    .map((row) => row.key);

  const canTakeDraft = (key: string): boolean => {
    const slot = result.get(key);
    const total = orderCounts.get(key) ?? 0;
    if (!slot) {
      return false;
    }
    return total - slot.confirmed - slot.draft > 0;
  };

  const canTakeConfirmed = (key: string): boolean => {
    const slot = result.get(key);
    const total = orderCounts.get(key) ?? 0;
    if (!slot) {
      return false;
    }
    return total - slot.confirmed - slot.draft > 0;
  };

  const pickEligible = (canTake: (key: string) => boolean): string => {
    const keys = eligible.filter(canTake);
    if (keys.length === 0) {
      throw new Error("leftover allocation ran out of eligible customers");
    }
    return rng.pick(keys);
  };

  while (draftRemaining > 0) {
    const key = pickEligible(canTakeDraft);
    const slot = result.get(key);
    if (!slot) {
      throw new Error("leftover slot missing");
    }
    slot.draft += 1;
    draftRemaining -= 1;
  }

  while (confirmedRemaining > 0) {
    const key = pickEligible(canTakeConfirmed);
    const slot = result.get(key);
    if (!slot) {
      throw new Error("leftover slot missing");
    }
    slot.confirmed += 1;
    confirmedRemaining -= 1;
  }

  const idle = result.get("idlePark");
  if (idle && (idle.confirmed > 0 || idle.draft > 0)) {
    throw new Error("Idle Park cannot own leftover orders");
  }

  return result;
}

function shipToSnapshot(
  shipTos: readonly PlannedShipTo[],
  customer: PlannedCustomer,
): Omit<PlannedShipTo, "key" | "customerKey"> {
  const shipTo = shipTos.find((row) => row.key === customer.shipToKey);
  if (!shipTo) {
    throw new Error(`missing ship-to for ${customer.key}`);
  }
  return {
    line1: shipTo.line1,
    line2: shipTo.line2,
    city: shipTo.city,
    region: shipTo.region,
    postal: shipTo.postal,
    country: shipTo.country,
    isDefault: shipTo.isDefault,
  };
}

function sampleShippedInstant(
  rng: SeededRandom,
  customer: PlannedCustomer,
  seedToday: Date,
  historicalStart: Date,
  idleParkCurrentKey: string | null,
  orderKey: string,
): Date {
  if (customer.persona === "idlePark") {
    if (orderKey === idleParkCurrentKey) {
      return sampleHistoricalInstant(rng, addUtcDays(seedToday, -(IDLE_PARK_DORMANCY_DAYS - 1)), seedToday, {
        seedToday,
      });
    }
    return sampleHistoricalInstant(rng, historicalStart, addUtcDays(seedToday, -IDLE_PARK_DORMANCY_DAYS), {
      seedToday,
      excludeLastDays: IDLE_PARK_DORMANCY_DAYS,
    });
  }
  if (customer.persona === "harvest" && rng.bool(HARVEST_Q4_SHIPPED_FRACTION)) {
    return sampleHistoricalInstant(rng, historicalStart, seedToday, {
      seedToday,
      q4Only: true,
    });
  }
  return sampleHistoricalInstant(rng, historicalStart, seedToday, { seedToday });
}

export function chooseLeftoverSalesOrderCounts(
  rng: SeededRandom,
  counts: DemoCounts = DEMO_COUNTS,
): number {
  if (counts.salesOrders <= 20) {
    return 0;
  }
  return rng.int(counts.leftoverConfirmedSalesOrderMin, counts.leftoverConfirmedSalesOrderMax);
}

export function planSalesOrders(input: {
  rng: SeededRandom;
  seedToday: Date;
  historicalStart: Date;
  customers: readonly PlannedCustomer[];
  shipTos: readonly PlannedShipTo[];
  products: readonly PlannedProduct[];
  leftoverConfirmedCount: number;
  counts?: DemoCounts;
  personaOrderBudgets?: PersonaOrderBudgets;
}): PlannedSalesOrder[] {
  const counts = input.counts ?? DEMO_COUNTS;
  const personaOrderBudgets = input.personaOrderBudgets ?? PERSONA_ORDER_BUDGETS;
  const orderCounts = allocateCustomerOrderCounts(
    input.rng,
    input.customers,
    counts,
    personaOrderBudgets,
  );
  const leftovers = assignLeftoverCounts(
    input.rng,
    input.customers,
    orderCounts,
    input.leftoverConfirmedCount,
    counts,
  );

  const lineCounts: number[] = [];
  const orders: PlannedSalesOrder[] = [];
  let orderSequence = 0;
  const allSkus = input.products.map((row) => row.sku);
  const priceBySku = new Map(
    input.products.map((row) => [row.sku, row.listPriceCents ?? row.memberPriceCents]),
  );
  const phase1Coverage = new Set<string>();
  const lineCountQueues = new Map<string, number[]>(
    input.customers.map((customer) => {
      const orderCount = orderCounts.get(customer.key) ?? 0;
      return [customer.key, buildCustomerLineCounts(input.rng, customer, orderCount, counts)];
    }),
  );

  const nextLineCount = (customerKey: string): number => {
    const queue = lineCountQueues.get(customerKey);
    if (!queue || queue.length === 0) {
      throw new Error(`missing line counts for ${customerKey}`);
    }
    const lineCount = queue.shift();
    if (lineCount === undefined) {
      throw new Error(`missing line count for ${customerKey}`);
    }
    lineCounts.push(lineCount);
    return lineCount;
  };

  const idleParkCurrentKey = counts.salesOrders > 20 ? `so-idle-current` : null;
  let idleParkCurrentAssigned = counts.salesOrders <= 20;

  for (const customer of input.customers) {
    const totalForCustomer = orderCounts.get(customer.key) ?? 0;
    const leftover = leftovers.get(customer.key) ?? { confirmed: 0, draft: 0 };
    const shippedCount = totalForCustomer - leftover.confirmed - leftover.draft;

    for (let index = 0; index < shippedCount; index += 1) {
      orderSequence += 1;
      const lineCount = nextLineCount(customer.key);
      let skus = pickDistinct(input.rng, allSkus, lineCount);
      if (customer.persona === "acme" && index === 0) {
        const phase1Sku = PHASE1_PRODUCT_SKUS[0];
        if (phase1Sku !== undefined) {
          skus = [phase1Sku, ...skus.filter((sku) => sku !== phase1Sku)].slice(0, lineCount);
        }
      }
      skus.forEach((sku) => phase1Coverage.add(sku));
      let orderKey = `so-${String(orderSequence).padStart(5, "0")}`;
      if (customer.persona === "idlePark" && !idleParkCurrentAssigned && idleParkCurrentKey !== null) {
        orderKey = idleParkCurrentKey;
        idleParkCurrentAssigned = true;
      }
      orders.push({
        key: orderKey,
        customerKey: customer.key,
        plannedInstant: sampleShippedInstant(
          input.rng,
          customer,
          input.seedToday,
          input.historicalStart,
          idleParkCurrentKey,
          orderKey,
        ),
        status: "shipped",
        shipTo: shipToSnapshot(input.shipTos, customer),
        lines: skus.map((sku) => ({
          sku,
          qty: 0,
          unitPriceCents: priceBySku.get(sku) ?? 0,
        })),
      });
    }

    for (let index = 0; index < leftover.confirmed; index += 1) {
      orderSequence += 1;
      const lineCount = nextLineCount(customer.key);
      const skus = pickDistinct(input.rng, allSkus, lineCount);
      orders.push({
        key: `so-${String(orderSequence).padStart(5, "0")}`,
        customerKey: customer.key,
        plannedInstant: sampleLeftoverInstant(
          input.rng,
          input.seedToday,
          counts.leftoverWindowDays,
        ),
        status: "leftoverConfirmed",
        shipTo: shipToSnapshot(input.shipTos, customer),
        lines: skus.map((sku) => ({
          sku,
          qty: 0,
          unitPriceCents: priceBySku.get(sku) ?? 0,
        })),
      });
    }

    for (let index = 0; index < leftover.draft; index += 1) {
      orderSequence += 1;
      const lineCount = nextLineCount(customer.key);
      const skus = pickDistinct(input.rng, allSkus, lineCount);
      orders.push({
        key: `so-${String(orderSequence).padStart(5, "0")}`,
        customerKey: customer.key,
        plannedInstant: sampleLeftoverInstant(
          input.rng,
          input.seedToday,
          counts.leftoverWindowDays,
        ),
        status: "leftoverDraft",
        shipTo: shipToSnapshot(input.shipTos, customer),
        lines: skus.map((sku) => ({
          sku,
          qty: 0,
          unitPriceCents: priceBySku.get(sku) ?? 0,
        })),
      });
    }
  }

  if (counts.salesOrders <= 20) {
    const generatedSkus = allSkus.filter(
      (sku) => !PHASE1_PRODUCT_SKUS.includes(sku as (typeof PHASE1_PRODUCT_SKUS)[number]),
    );
    const shippedOrders = orders.filter((row) => row.status === "shipped");
    for (const [index, order] of shippedOrders.entries()) {
      const line = order.lines[0];
      if (line === undefined) {
        throw new Error(`reduced shipped order ${order.key} is missing a line`);
      }
      const phase1Sku = PHASE1_PRODUCT_SKUS[index];
      if (phase1Sku !== undefined) {
        line.sku = phase1Sku;
        line.unitPriceCents = priceBySku.get(phase1Sku) ?? 0;
        phase1Coverage.add(phase1Sku);
        continue;
      }
      const offset = index - PHASE1_PRODUCT_SKUS.length;
      const sku = generatedSkus[offset % generatedSkus.length];
      if (sku === undefined) {
        throw new Error("reduced shipped order is missing a generated SKU");
      }
      line.sku = sku;
      line.unitPriceCents = priceBySku.get(sku) ?? 0;
      phase1Coverage.add(sku);
    }
    for (const [index, order] of shippedOrders.entries()) {
      order.plannedInstant = addUtcDays(input.seedToday, -(shippedOrders.length - index));
    }
  }

  const totalLines = lineCounts.reduce((sum, value) => sum + value, 0);
  const soQtyMin = counts.salesOrders <= 20 ? 1 : SO_LINE_QTY_MIN;
  const soQtyMax = counts.salesOrders <= 20 ? 1 : SO_LINE_QTY_MAX;
  const soQtyMean = counts.salesOrders <= 20 ? 1 : SO_LINE_QTY_MEAN;
  const quantities = buildCorpusIntegers(
    input.rng,
    totalLines,
    soQtyMin,
    soQtyMax,
    soQtyMean,
  );
  let quantityCursor = 0;
  for (const order of orders) {
    for (const line of order.lines) {
      const qty = quantities[quantityCursor];
      quantityCursor += 1;
      if (qty === undefined) {
        throw new Error("missing SO line quantity");
      }
      line.qty = qty;
    }
    const uniqueSkus = new Set(order.lines.map((line) => line.sku));
    if (uniqueSkus.size !== order.lines.length) {
      throw new Error(`${order.key} repeats a SKU on one document`);
    }
  }

  if (counts.salesOrders > 20) {
    for (const sku of PHASE1_PRODUCT_SKUS) {
      if (!phase1Coverage.has(sku)) {
        throw new Error(`Phase 1 SKU ${sku} missing from shipped SO plan`);
      }
    }
  }

  if (orders.length !== counts.salesOrders) {
    throw new Error(`expected ${String(counts.salesOrders)} sales orders`);
  }
  if (orders.filter((row) => row.status === "shipped").length !== counts.shippedSalesOrders) {
    throw new Error("shipped sales order count mismatch");
  }
  const defaultPersonaLineCounts = orders
    .filter((row) => {
      const customer = input.customers.find((entry) => entry.key === row.customerKey);
      return customer?.persona === "acme" || customer?.persona === "mix";
    })
    .flatMap((row) => [row.lines.length]);
  if (
    counts.salesOrders > 20 &&
    defaultPersonaLineCounts.length > 0 &&
    Math.abs(mean(defaultPersonaLineCounts) - SO_LINE_COUNT_DEFAULT_MEAN) > 1e-9
  ) {
    throw new Error(
      `default SO line corpus mean ${String(mean(defaultPersonaLineCounts))}, expected ${String(SO_LINE_COUNT_DEFAULT_MEAN)}`,
    );
  }
  if (counts.salesOrders > 20 && Math.abs(mean(quantities) - SO_LINE_QTY_MEAN) > 1e-9) {
    throw new Error(`SO qty corpus mean ${String(mean(quantities))}, expected ${String(SO_LINE_QTY_MEAN)}`);
  }

  const acmeDrafts = orders.filter((row) => row.customerKey === "acme" && row.status === "leftoverDraft");
  if (acmeDrafts.length === 0) {
    throw new Error("Acme Wholesale has no leftover draft");
  }

  if (counts.salesOrders > 20) {
    const harvestShipped = orders.filter((row) => row.customerKey === "harvest" && row.status === "shipped");
    const harvestTarget = Math.round(harvestShipped.length * HARVEST_Q4_SHIPPED_FRACTION);
    let harvestQ4 = harvestShipped.filter((row) => isQ4Month(row.plannedInstant)).length;
    const nonQ4 = harvestShipped.filter((row) => !isQ4Month(row.plannedInstant));
    let cursor = 0;
    while (harvestQ4 < harvestTarget && cursor < nonQ4.length) {
      const order = nonQ4[cursor];
      if (order === undefined) {
        break;
      }
      order.plannedInstant = sampleHistoricalInstant(
        input.rng,
        input.historicalStart,
        input.seedToday,
        { seedToday: input.seedToday, q4Only: true },
      );
      harvestQ4 += 1;
      cursor += 1;
    }
    if (harvestQ4 < harvestTarget) {
      throw new Error("Harvest Q4 shipped fraction not met");
    }
  }

  const idleOutside = orders.filter(
    (row) =>
      row.customerKey === "idlePark" &&
      row.status === "shipped" &&
      (idleParkCurrentKey === null || row.key !== idleParkCurrentKey) &&
      utcDayDiff(row.plannedInstant, input.seedToday) >= IDLE_PARK_DORMANCY_DAYS,
  );
  if (idleOutside.length === 0 && counts.salesOrders > 20) {
    throw new Error("Idle Park dormancy plan missing older shipped history");
  }

  const leftoversAllRecent = orders
    .filter((row) => row.status !== "shipped")
    .every((row) =>
      isWithinLastDays(row.plannedInstant, input.seedToday, counts.leftoverWindowDays),
    );
  if (!leftoversAllRecent) {
    throw new Error("leftover sales orders are not all recent");
  }

  return orders;
}

export function planIdleParkAges(input: {
  rng: SeededRandom;
  seedToday: Date;
  idleParkShippedOrders: readonly PlannedSalesOrder[];
  currentOrderKey: string | null;
}): Map<string, Date> {
  const buckets = ["current", "30_59", "60_89", "90_plus"] as const;
  const planned = new Map<string, Date>();
  const historical =
    input.currentOrderKey === null
      ? [...input.idleParkShippedOrders]
      : input.idleParkShippedOrders.filter((row) => row.key !== input.currentOrderKey);
  if (historical.length < buckets.length) {
    throw new Error("not enough Idle Park shipped orders to cover AR buckets");
  }

  for (const [index, bucket] of buckets.entries()) {
    const order = historical[index];
    if (!order) {
      throw new Error("Idle Park bucket order missing");
    }
    const ageByBucket = {
      current: 10,
      "30_59": 45,
      "60_89": 75,
      "90_plus": 120,
    } as const;
    planned.set(order.key, addUtcDays(input.seedToday, -ageByBucket[bucket]));
    if (demoArBucket(ageByBucket[bucket]) !== bucket) {
      throw new Error(`bucket mapping drift for ${bucket}`);
    }
  }

  for (const order of historical.slice(buckets.length)) {
    planned.set(
      order.key,
      sampleHistoricalInstant(
        input.rng,
        addUtcDays(input.seedToday, -500),
        addUtcDays(input.seedToday, -IDLE_PARK_DORMANCY_DAYS),
        { seedToday: input.seedToday, excludeLastDays: IDLE_PARK_DORMANCY_DAYS },
      ),
    );
  }

  const current =
    input.currentOrderKey === null
      ? undefined
      : input.idleParkShippedOrders.find((row) => row.key === input.currentOrderKey);
  if (current) {
    planned.set(current.key, addUtcDays(input.seedToday, -5));
  }

  return planned;
}
