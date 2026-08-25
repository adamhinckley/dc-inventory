import {
  PHASE1_CUSTOMER_CURRENCY,
  PHASE1_CUSTOMER_NAME,
  PHASE1_CUSTOMER_TERMS,
  PHASE1_PRODUCTS,
  PHASE1_STAFF_EMAIL,
  PHASE1_WHOLESALE_EMAIL,
} from "../phase1-fixture.js";
import { DEMO_NAMED_CUSTOMERS } from "../reconciliation/expectations.js";
import {
  DEMO_COUNTS,
  EXEMPTION_CUSTOMER_FRACTION,
  GENERATED_SKU_COUNT,
  GENERATED_SKU_FIRST,
  GENERATED_SKU_PREFIX,
  MEMBER_PRICE_MAX_CENTS,
  MEMBER_PRICE_MIN_CENTS,
  SUPPLIER_SKU_TARGET,
} from "./constants.js";
import type { SeededRandom } from "./seeded-random.js";
import type {
  PlannedCustomer,
  PlannedProduct,
  PlannedShipTo,
  PlannedSupplier,
  PlannedSupplierProduct,
} from "./types.js";
import {
  MIX_ADDRESS_CITIES,
  MIX_ADDRESS_STREETS,
  MIX_CUSTOMER_TRADE_TYPES,
  MIX_CUSTOMER_TRADE_WORDS,
  PRODUCT_ADJECTIVES,
  PRODUCT_NOUNS,
  RESERVED_CUSTOMER_NAMES,
  RESERVED_PRODUCT_NAMES,
  RESERVED_SUPPLIER_NAMES,
  SUPPLIER_MILL_SUFFIXES,
} from "./word-lists.js";

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function generatedSku(sequence: number): string {
  return `${GENERATED_SKU_PREFIX}${String(sequence).padStart(5, "0")}`;
}

export function planProducts(rng: SeededRandom): PlannedProduct[] {
  const products: PlannedProduct[] = PHASE1_PRODUCTS.map((row) => ({
    key: row.sku,
    sku: row.sku,
    name: row.name,
    uom: row.uom,
    memberPriceCents: row.memberPriceCents,
    description: null,
    listPriceCents: null,
    currency: "USD",
    webWholesale: true,
    taxCategoryCode: "TANGIBLE",
    imageObjectKey: `demo/catalog/${row.sku}.jpg`,
    imageContentType: "image/jpeg",
    isPhase1Fixture: true,
  }));

  const usedNames = new Set<string>([...RESERVED_PRODUCT_NAMES]);
  for (let sequence = GENERATED_SKU_FIRST; sequence <= GENERATED_SKU_FIRST + GENERATED_SKU_COUNT - 1; sequence += 1) {
    const sku = generatedSku(sequence);
    let name = "";
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      const candidate = sentenceCase(
        `${rng.pick(PRODUCT_ADJECTIVES)} ${rng.pick(PRODUCT_NOUNS)}`.replace(/\s+/g, " "),
      );
      if (!usedNames.has(candidate)) {
        name = candidate;
        usedNames.add(candidate);
        break;
      }
    }
    if (name.length === 0) {
      throw new Error("fastener word lists cannot produce enough unique product names");
    }
    products.push({
      key: sku,
      sku,
      name,
      uom: "EA",
      memberPriceCents: rng.int(MEMBER_PRICE_MIN_CENTS, MEMBER_PRICE_MAX_CENTS),
      description: null,
      listPriceCents: null,
      currency: "USD",
      webWholesale: true,
      taxCategoryCode: "TANGIBLE",
      imageObjectKey: `demo/catalog/${sku}.jpg`,
      imageContentType: "image/jpeg",
      isPhase1Fixture: false,
    });
  }

  if (products.length !== DEMO_COUNTS.products) {
    throw new Error(`expected ${String(DEMO_COUNTS.products)} products`);
  }
  return products;
}

export function planSuppliers(rng: SeededRandom): PlannedSupplier[] {
  const suppliers: PlannedSupplier[] = [
    {
      key: "vend-001",
      vendorNumber: "VEND-001",
      name: "Demo Supplier",
    },
  ];
  const suffixes = rng.shuffle([...SUPPLIER_MILL_SUFFIXES]);
  for (let index = 2; index <= DEMO_COUNTS.suppliers; index += 1) {
    const suffix = suffixes[index - 2];
    if (suffix === undefined) {
      throw new Error("supplier suffix list exhausted");
    }
    let name: string = suffix;
    let attempt = 0;
    while (RESERVED_SUPPLIER_NAMES.has(name) || suppliers.some((row) => row.name === name)) {
      attempt += 1;
      name = `${suffix} ${attempt}`;
    }
    suppliers.push({
      key: `vend-${String(index).padStart(3, "0")}`,
      vendorNumber: `VEND-${String(index).padStart(3, "0")}`,
      name,
    });
  }
  return suppliers;
}

export function planSupplierProducts(
  products: readonly PlannedProduct[],
  suppliers: readonly PlannedSupplier[],
): PlannedSupplierProduct[] {
  const generated = products.filter((row) => !row.isPhase1Fixture).map((row) => row.sku);
  const assignments: PlannedSupplierProduct[] = PHASE1_PRODUCTS.map((row) => ({
    supplierKey: "vend-001",
    sku: row.sku,
    minOrderQty: null,
  }));

  const vend001GeneratedTake = Math.max(0, SUPPLIER_SKU_TARGET - PHASE1_PRODUCTS.length);
  const vend001Generated = generated.slice(0, vend001GeneratedTake);
  const remainingGenerated = generated.slice(vend001GeneratedTake);
  for (const sku of vend001Generated) {
    assignments.push({ supplierKey: "vend-001", sku, minOrderQty: null });
  }

  const otherSupplierKeys = suppliers.filter((row) => row.key !== "vend-001").map((row) => row.key);
  const perOther = Math.floor(remainingGenerated.length / otherSupplierKeys.length);
  const remainder = remainingGenerated.length % otherSupplierKeys.length;
  let cursor = 0;
  for (const [index, supplierKey] of otherSupplierKeys.entries()) {
    const take = perOther + (index < remainder ? 1 : 0);
    for (const sku of remainingGenerated.slice(cursor, cursor + take)) {
      assignments.push({ supplierKey, sku, minOrderQty: null });
    }
    cursor += take;
  }

  const bySku = new Map<string, PlannedSupplierProduct>();
  for (const row of assignments) {
    if (bySku.has(row.sku)) {
      throw new Error(`duplicate supplier assignment for ${row.sku}`);
    }
    bySku.set(row.sku, row);
  }
  if (bySku.size !== products.length) {
    throw new Error("supplier partition does not cover every SKU");
  }
  return [...bySku.values()];
}

function buildMixCustomerName(rng: SeededRandom, used: Set<string>): string {
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const word = rng.pick(MIX_CUSTOMER_TRADE_WORDS);
    const type = rng.pick(MIX_CUSTOMER_TRADE_TYPES);
    const candidate = `${word} ${type}`;
    if (!used.has(candidate) && !RESERVED_CUSTOMER_NAMES.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  throw new Error("unable to generate enough unique mix customer names");
}

function buildMixAddress(
  rng: SeededRandom,
  used: Set<string>,
  reservedPins: readonly { line1: string; city: string; region: string; postal: string }[],
): Omit<PlannedShipTo, "key" | "customerKey"> {
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const street = rng.pick(MIX_ADDRESS_STREETS);
    const cityPin = rng.pick(MIX_ADDRESS_CITIES);
    const line1 = `${rng.int(1, 9999)} ${street}`;
    const signature = `${line1}|${cityPin.city}|${cityPin.region}|${cityPin.postal}`;
    const reserved = reservedPins.some(
      (pin) =>
        pin.line1 === line1 &&
        pin.city === cityPin.city &&
        pin.region === cityPin.region &&
        pin.postal === cityPin.postal,
    );
    if (!reserved && !used.has(signature)) {
      used.add(signature);
      return {
        line1,
        line2: null,
        city: cityPin.city,
        region: cityPin.region,
        postal: cityPin.postal,
        country: "US",
        isDefault: true,
      };
    }
  }
  throw new Error("unable to generate enough unique mix addresses");
}

export function planCustomersAndShipTos(rng: SeededRandom): {
  customers: PlannedCustomer[];
  shipTos: PlannedShipTo[];
} {
  const namedEntries = [
    ["acme", DEMO_NAMED_CUSTOMERS.acme, "acme"] as const,
    ["northstar", DEMO_NAMED_CUSTOMERS.northstar, "northstar"] as const,
    ["harvest", DEMO_NAMED_CUSTOMERS.harvest, "harvest"] as const,
    ["idlePark", DEMO_NAMED_CUSTOMERS.idlePark, "idlePark"] as const,
  ];

  const shipTos: PlannedShipTo[] = [];
  const customers: PlannedCustomer[] = [];
  const usedNames = new Set<string>([...RESERVED_CUSTOMER_NAMES]);
  const usedAddresses = new Set<string>();
  const reservedPins = namedEntries.map(([, pin]) => pin.ship);

  for (const [key, pin, persona] of namedEntries) {
    usedNames.add(pin.name);
    const shipToKey = `ship-${key}`;
    shipTos.push({
      key: shipToKey,
      customerKey: key,
      line1: pin.ship.line1,
      line2: null,
      city: pin.ship.city,
      region: pin.ship.region,
      postal: pin.ship.postal,
      country: "US",
      isDefault: true,
    });
    customers.push({
      key,
      name: pin.name,
      creditLimitCents: pin.creditLimitCents,
      currency: "USD",
      terms: "Net 30",
      persona,
      shipToKey,
      hasExemptionCertificate: false,
    });
  }

  for (let index = 1; index <= DEMO_COUNTS.mixCustomers; index += 1) {
    const key = `mix-${String(index).padStart(3, "0")}`;
    const name = buildMixCustomerName(rng, usedNames);
    const shipToKey = `ship-${key}`;
    const shipTo = buildMixAddress(rng, usedAddresses, reservedPins);
    shipTos.push({ key: shipToKey, customerKey: key, ...shipTo });
    customers.push({
      key,
      name,
      creditLimitCents: 1_000_000,
      currency: "USD",
      terms: "Net 30",
      persona: "mix",
      shipToKey,
      hasExemptionCertificate: false,
    });
  }

  const exemptionTarget = Math.round(DEMO_COUNTS.customers * EXEMPTION_CUSTOMER_FRACTION);
  const exemptionKeys = rng
    .shuffle(customers.map((row) => row.key))
    .slice(0, exemptionTarget);
  const exempt = new Set(exemptionKeys);
  for (const customer of customers) {
    customer.hasExemptionCertificate = exempt.has(customer.key);
  }

  if (customers.length !== DEMO_COUNTS.customers) {
    throw new Error(`expected ${String(DEMO_COUNTS.customers)} customers`);
  }
  return { customers, shipTos };
}

export function planIdentityEmails(): {
  staffEmail: string;
  wholesaleEmail: string;
  wholesaleCustomerKey: "acme";
} {
  return {
    staffEmail: PHASE1_STAFF_EMAIL,
    wholesaleEmail: PHASE1_WHOLESALE_EMAIL,
    wholesaleCustomerKey: "acme",
  };
}

export function assertPhase1FixturesPreserved(products: readonly PlannedProduct[]): void {
  for (const fixture of PHASE1_PRODUCTS) {
    const row = products.find((product) => product.sku === fixture.sku);
    if (!row) {
      throw new Error(`missing Phase 1 SKU ${fixture.sku}`);
    }
    if (row.name !== fixture.name || row.uom !== fixture.uom || row.memberPriceCents !== fixture.memberPriceCents) {
      throw new Error(`Phase 1 fixture drift for ${fixture.sku}`);
    }
  }
  if (products.filter((row) => row.isPhase1Fixture).length !== PHASE1_PRODUCTS.length) {
    throw new Error("Phase 1 fixture count mismatch");
  }
}

export function assertNamedCustomerPins(customers: readonly PlannedCustomer[]): void {
  const acme = customers.find((row) => row.key === "acme");
  if (!acme || acme.name !== PHASE1_CUSTOMER_NAME) {
    throw new Error("Acme Wholesale missing from plan");
  }
  if (acme.creditLimitCents !== 1_000_000 || acme.currency !== PHASE1_CUSTOMER_CURRENCY || acme.terms !== PHASE1_CUSTOMER_TERMS) {
    throw new Error("Acme commercial fields drift");
  }
}
