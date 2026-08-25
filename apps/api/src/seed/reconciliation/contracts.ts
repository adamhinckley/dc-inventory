export const DEMO_RECONCILIATION_CONTRACTS = [
  "product_count",
  "supplier_count",
  "customer_count",
  "purchase_order_count",
  "sales_order_count",
  "invoice_count",
  "payment_count",
  "image_count",
  "supplier_product_count",
  "reorder_policy_count",
  "document_number_format",
  "document_number_endpoints",
  "phase1_fixture_preservation",
  "identity_rows",
  "named_customer_fields",
  "default_ship_tos",
  "shop_visibility",
  "tax_category_metadata",
  "image_key_format",
  "unique_names",
  "no_mix_persona_contacts",
  "no_extra_users",
  "vendor_partition",
  "repeated_sku",
  "stock_from_movements",
  "invoice_totals",
  "omitted_tax",
  "invoice_remainder",
  "payment_completeness",
  "named_customer_payments",
  "ar_age_buckets",
  "idle_park_aged_ar",
  "open_document_mix",
  "leftover_recency",
  "acme_draft",
  "idle_park_open_pipeline",
  "low_stock",
] as const;

export type DemoReconciliationContract = (typeof DEMO_RECONCILIATION_CONTRACTS)[number];

export type DemoReconciliationResult =
  | { ok: true }
  | { ok: false; contract: DemoReconciliationContract; message: string };

export function failContract(
  contract: DemoReconciliationContract,
  message: string,
): DemoReconciliationResult {
  return { ok: false, contract, message };
}
