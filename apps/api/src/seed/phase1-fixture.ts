/**
 * Stable Phase 1 local/demo rows. Upsert keys are SKU / email / Customer name.
 * Names and MP cents are implementer-chosen; money is integer cents, not floats.
 */

export const PHASE1_CUSTOMER_NAME = "Acme Wholesale";
export const PHASE1_ORGANIZATION_SLUG = "acme";
export const PHASE1_CUSTOMER_TERMS = "Net 30";
export const PHASE1_CUSTOMER_CREDIT_LIMIT_CENTS = 1_000_000;
export const PHASE1_CUSTOMER_CURRENCY = "USD";

export const PHASE1_STAFF_EMAIL = "staff@local.test";
export const PHASE1_WHOLESALE_EMAIL = "wholesale@local.test";
/** Second demo shop login for Northstar Big Box (staff-acting picker smoke). */
export const PHASE1_NORTHSTAR_WHOLESALE_EMAIL = "northstar@local.test";

export const PHASE1_PRODUCT_SKUS = [
  "HEX-BOLT-GALV",
  "WASHER-SS-PACK",
  "LOCK-NUT-NYL",
  "FLAT-WASHER-ZINC",
  "COUPLING-NUT-GR8",
] as const;

export type Phase1ProductSku = (typeof PHASE1_PRODUCT_SKUS)[number];

export type Phase1ProductFixture = {
  sku: Phase1ProductSku;
  name: string;
  uom: string;
  listPriceCents: number;
  memberPriceCents: number;
  currency: "USD";
};

export const PHASE1_PRODUCTS: readonly Phase1ProductFixture[] = [
  {
    sku: "HEX-BOLT-GALV",
    name: "Galvanized hex bolt",
    uom: "EA",
    listPriceCents: 1250,
    memberPriceCents: 12_000,
    currency: "USD",
  },
  {
    sku: "WASHER-SS-PACK",
    name: "Stainless washer pack",
    uom: "PK",
    listPriceCents: 450,
    memberPriceCents: 4_500,
    currency: "USD",
  },
  {
    sku: "LOCK-NUT-NYL",
    name: "Nylon lock nut",
    uom: "EA",
    listPriceCents: 85,
    memberPriceCents: 850,
    currency: "USD",
  },
  {
    sku: "FLAT-WASHER-ZINC",
    name: "Zinc flat washer",
    uom: "EA",
    listPriceCents: 35,
    memberPriceCents: 350,
    currency: "USD",
  },
  {
    sku: "COUPLING-NUT-GR8",
    name: "Grade 8 coupling nut",
    uom: "EA",
    listPriceCents: 275,
    memberPriceCents: 2_750,
    currency: "USD",
  },
];
