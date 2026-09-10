import { z } from "zod";

export const loginBodySchema = z.object({
  organizationSlug: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
});

export const unauthorizedResponseSchema = z.object({
  error: z.literal("unauthorized"),
});

export const forbiddenResponseSchema = z.object({
  error: z.literal("forbidden"),
});

export const featureDisabledResponseSchema = z.object({
  error: z.literal("feature_disabled"),
});

export const needsCustomerResponseSchema = z.object({
  error: z.literal("needs_customer"),
});

export const tooManyLoginAttemptsResponseSchema = z.object({
  error: z.literal("too_many_login_attempts"),
  retryAfterSeconds: z.number().int().positive(),
});

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});

export const staffSessionResponseSchema = z.object({
  staffUserId: z.string().uuid(),
  email: z.string(),
  organizationId: z.string(),
  roles: z.array(
    z.enum(["admin", "purchasing", "warehouse", "sales_support", "accounting"]),
  ),
});

export const wholesaleSessionResponseSchema = z.object({
  mode: z.enum(["buyer", "staff_acting"]),
  staffUserId: z.string().uuid().nullable(),
  wholesaleUserId: z.string().uuid().nullable(),
  email: z.string(),
  customerId: z.string().uuid().nullable(),
  organizationId: z.string(),
});

export const actingCustomerPickerItemSchema = z.object({
  customerId: z.string().uuid(),
  businessName: z.string(),
  customerNumber: z.string(),
  accountStatus: z.enum(["active", "on_hold", "inactive"]),
});

export const listActingCustomersResponseSchema = z.object({
  items: z.array(actingCustomerPickerItemSchema),
});

export const selectActingCustomerBodySchema = z.object({
  customerId: z.string().uuid(),
});

export const opsSessionResponseSchema = z.object({
  opsUserId: z.string().uuid(),
  email: z.string(),
  kind: z.enum(["operator", "business_owner"]),
  tenantId: z.string(),
});

function optionalRepeatedQuery<T extends z.ZodType<string>>(item: T) {
  return z
    .union([item, z.array(item)])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return undefined;
      }
      const items = (Array.isArray(value) ? value : [value]).filter(
        (entry) => entry.length > 0,
      );
      return items.length === 0 ? undefined : items;
    });
}

const optionalBooleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    return value === true || value === "true";
  });

export const staffProductSortByValues = [
  "sku",
  "name",
  "onHand",
  "onOrder",
  "allocated",
  "available",
  "committed",
  "availableToSell",
  "sellState",
  "caseQty",
  "createdAt",
] as const;

export const sellStateSchema = z.enum(["open", "locked"]);

export const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(staffProductSortByValues).default("sku"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  inactive: optionalBooleanQuery,
  hideZeroInventory: optionalBooleanQuery,
  category: optionalRepeatedQuery(z.string().trim().min(1)),
  supplierId: optionalRepeatedQuery(z.string().uuid()),
  excludeSupplierId: optionalRepeatedQuery(z.string().uuid()),
  sellState: sellStateSchema.optional(),
});

export const productQtyFieldsSchema = z.object({
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
  committed: z.number().int(),
  sellState: sellStateSchema,
  availableToSell: z.number().int().nullable(),
});

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  memberPrice: z.number().int(),
  listPrice: z.number().int().nullable(),
  lastPoCostCents: z.number().int().nullable(),
  supplierName: z.string().nullable(),
  currency: z.string(),
  inactive: z.boolean(),
  discontinued: z.boolean(),
  webWholesale: z.boolean(),
  ...productQtyFieldsSchema.shape,
  caseQty: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
});

export const productListResponseSchema = z.object({
  items: z.array(productListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const categoryListResponseSchema = z.object({
  items: z.array(z.object({ name: z.string() })),
});

const catalogAvailableOnlyQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .default(true)
  .transform((value) => value === true || value === "true");

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["name", "available"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  availableOnly: catalogAvailableOnlyQuery,
});

export const catalogItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  wholesalePrice: z.number().int(),
  currency: z.string(),
  available: z.number().int(),
  committed: z.number().int(),
  sellState: sellStateSchema,
  availableToSell: z.number().int().nullable(),
});

export const catalogListResponseSchema = z.object({
  items: z.array(catalogItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const opsSubscriptionSchema = z.object({
  status: z.enum(["trialing", "active", "past_due", "canceled", "inactive"]),
  plan: z.string().nullable(),
});

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const productSkuParamsSchema = z.object({
  sku: z.string().min(1),
});

export const inventoryStockParamsSchema = z.object({
  sku: z.string().min(1),
});

export const inventoryStockSnapshotSchema = z.object({
  sku: z.string(),
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
});

export const uncoveredSkusListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  supplierId: z.string().uuid().optional(),
  needsMapping: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const uncoveredSkuDraftPurchaseOrderRefSchema = z.object({
  id: z.string().uuid(),
  documentNumber: z.string(),
});

export const uncoveredSkuListItemSchema = z.object({
  sku: z.string(),
  uncovered: z.number().int().nonnegative(),
  onHand: z.number().int(),
  onOrder: z.number().int(),
  committed: z.number().int(),
  caseQty: z.number().int().positive().nullable(),
  reorderMin: z.number().int().nullable(),
  reorderMax: z.number().int().nullable(),
  supplierId: z.string().uuid().nullable(),
  supplierNumber: z.string().nullable(),
  supplierName: z.string().nullable(),
  mappingStatus: z.enum(["mapped", "unmapped", "ambiguous"]),
  draftPurchaseOrder: uncoveredSkuDraftPurchaseOrderRefSchema.nullable(),
});

export const uncoveredSkusListResponseSchema = z.object({
  items: z.array(uncoveredSkuListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const uncoveredSkusListTable = {
  rowId: "sku",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "supplierName", label: "Factory" },
    { field: "supplierNumber", label: "Factory #" },
    { field: "uncovered", label: "Uncovered" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "committed", label: "Committed (pre-sold)" },
    { field: "caseQty", label: "Master pack" },
    { field: "reorderMin", label: "Reorder min" },
    { field: "reorderMax", label: "Reorder max" },
    { field: "mappingStatus", label: "Mapping" },
    { field: "draftPurchaseOrder.documentNumber", label: "Draft PO" },
  ],
};

export const uncoveredFactoriesListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  excludeSuppliersWithOpenDraft: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const uncoveredFactoriesListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      supplierId: z.string().uuid().nullable(),
      supplierNumber: z.string().nullable(),
      supplierName: z.string(),
      poPrefix: z
        .string()
        .regex(/^[A-Z0-9]{2,4}$/)
        .nullable(),
      productCount: z.number().int().nonnegative(),
      totalUncoveredUnits: z.number().int().nonnegative(),
      needsMapping: z.boolean(),
    }),
  ),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const uncoveredFactoriesListTable = {
  rowId: "id",
  columns: [
    { field: "supplierName", label: "Factory" },
    { field: "supplierNumber", label: "Factory #" },
    { field: "poPrefix", label: "Vendor prefix" },
    { field: "productCount", label: "Products" },
    { field: "totalUncoveredUnits", label: "Uncovered units" },
  ],
};

export const productWriteBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  uom: z.string().min(1),
  memberPriceCents: z.number().int().min(0),
  listPriceCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
  inactive: z.boolean().optional(),
  discontinued: z.boolean().optional(),
  webWholesale: z.boolean().optional(),
  description: z.string().optional().nullable(),
});

export const productPrimarySupplierFieldsSchema = z.object({
  vendorNumber: z.string().nullable(),
  vendorName: z.string().nullable(),
  minOrderQty: z.number().int().nullable(),
  minOrderAmountCents: z.number().int().nullable(),
  lastPoCostCents: z.number().int().nullable(),
});

export const productReorderFieldsSchema = z.object({
  reorderMin: z.number().int().nullable(),
  reorderMax: z.number().int().nullable(),
});

export const productCatalogDetailFieldsSchema = z.object({
  countryOfOrigin: z.string().nullable(),
  material: z.string().nullable(),
  length: z.string().nullable(),
  width: z.string().nullable(),
  height: z.string().nullable(),
  diameter: z.string().nullable(),
  size: z.string().nullable(),
  weight: z.string().nullable(),
  weightUom: z.string().nullable(),
  originalWholesalePriceCents: z.number().int().min(0).nullable(),
  catalogPage: z.string().nullable(),
  defaultOrderQty: z.number().int().positive().nullable(),
  defaultWeight: z.string().nullable(),
  defaultWeightUom: z.string().nullable(),
  nonStock: z.boolean(),
  noExport: z.boolean(),
  webRetail: z.boolean(),
});

export const productPackagingDetailFieldsSchema = z.object({
  packLength: z.string().nullable(),
  packWidth: z.string().nullable(),
  packHeight: z.string().nullable(),
  packWeight: z.string().nullable(),
  packWeightUom: z.string().nullable(),
  innerPackQty: z.number().int().positive().nullable(),
  innerPackLength: z.string().nullable(),
  innerPackWidth: z.string().nullable(),
  innerPackHeight: z.string().nullable(),
  innerPackWeight: z.string().nullable(),
  innerPackWeightUom: z.string().nullable(),
  caseQty: z.number().int().positive().nullable(),
  caseLength: z.string().nullable(),
  caseWidth: z.string().nullable(),
  caseHeight: z.string().nullable(),
  caseWeight: z.string().nullable(),
  caseWeightUom: z.string().nullable(),
});

export const productPatchBodySchema = z
  .object({
    name: z.string().min(1).optional(),
    uom: z.string().min(1).optional(),
    memberPriceCents: z.number().int().min(0).optional(),
    listPriceCents: z.number().int().min(0).nullable().optional(),
    currency: z.string().length(3).optional(),
    inactive: z.boolean().optional(),
    discontinued: z.boolean().optional(),
    webWholesale: z.boolean().optional(),
    description: z.string().optional().nullable(),
    upc: z.string().optional().nullable(),
    mfgCode: z.string().optional().nullable(),
    altCodes: z.array(z.string()).optional().nullable(),
    categoryNames: z.array(z.string()).optional().nullable(),
  })
  .merge(
    productCatalogDetailFieldsSchema
      .omit({ nonStock: true, noExport: true, webRetail: true })
      .partial()
      .extend({
        nonStock: z.boolean().optional(),
        noExport: z.boolean().optional(),
        webRetail: z.boolean().optional(),
      }),
  )
  .merge(productPackagingDetailFieldsSchema.partial());

export const productDetailSchema = z
  .object({
    id: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    uom: z.string(),
    memberPriceCents: z.number().int().min(0),
    listPriceCents: z.number().int().min(0).nullable(),
    currency: z.string(),
    inactive: z.boolean(),
    discontinued: z.boolean(),
    webWholesale: z.boolean(),
    categoryNames: z.array(z.string()),
    upc: z.string().nullable(),
    mfgCode: z.string().nullable(),
    altCodes: z.array(z.string()),
    ...productPrimarySupplierFieldsSchema.shape,
    ...productReorderFieldsSchema.shape,
    ...productQtyFieldsSchema.shape,
  })
  .merge(productCatalogDetailFieldsSchema)
  .merge(productPackagingDetailFieldsSchema);

export const duplicateSkuResponseSchema = z.object({
  error: z.literal("duplicate_sku"),
});

export const skuImmutableResponseSchema = z.object({
  error: z.literal("sku_immutable"),
});

export const qtyNotAllowedResponseSchema = z.object({
  error: z.literal("qty_not_allowed"),
});

export const SPREADSHEET_UPLOAD_MAX_BYTES = 10_000_000;

export const productImportQuerySchema = z.object({
  dryRun: optionalBooleanQuery,
});

export const productImportErrorSchema = z.object({
  row: z.number().int(),
  field: z.string(),
  message: z.string(),
});

export const productImportResultSchema = z.object({
  dryRun: z.boolean(),
  rowsOk: z.number().int(),
  created: z.number().int(),
  updated: z.number().int(),
  linked: z.number().int(),
  errors: z.array(productImportErrorSchema),
});

export const licensingSubscriptionItemSchema = z.object({
  id: z.string().uuid(),
  plan: z.string(),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
});

export const licensingListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const licensingSubscriptionListResponseSchema = z.object({
  items: z.array(licensingSubscriptionItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const licensingPaymentItemSchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  providerRef: z.string().nullable(),
  amountCents: z.number().int(),
});

export const licensingPaymentListResponseSchema = z.object({
  items: z.array(licensingPaymentItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const notFoundResponseSchema = z.object({
  error: z.literal("not_found"),
});

export const invalidResponseSchema = z.object({
  error: z.literal("invalid"),
});

export const invalidSellWindowResponseSchema = z.object({
  error: z.literal("invalid_sell_window"),
});

export const zodValidationErrorResponseSchema = z.object({
  error: z.literal("invalid_request"),
  message: z.literal("The request is invalid."),
  requestId: z.string(),
});

export const duplicateEmailResponseSchema = z.object({
  error: z.literal("duplicate_email"),
});

export const accountStatusSchema = z.enum(["active", "on_hold", "inactive"]);

export const customerListQuerySchema = z.object({
  q: z.string().optional(),
  accountStatus: accountStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum(["name", "createdAt", "creditLimitCents", "customerNumber"])
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const customerItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  customerNumber: z.string(),
  creditLimitCents: z.number().int(),
  currency: z.string(),
  terms: z.string(),
  taxId: z.string().nullable(),
  accountStatus: accountStatusSchema,
  customerNote: z.string().nullable(),
  staffNote: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const wholesaleCustomerItemSchema = customerItemSchema.omit({ staffNote: true });

export const customerListResponseSchema = z.object({
  items: z.array(customerItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const customersListTable = {
  rowId: "id",
  columns: [
    { field: "name", label: "Name" },
    { field: "customerNumber", label: "Customer #" },
    { field: "accountStatus", label: "Status" },
    { field: "terms", label: "Terms" },
  ],
  search: {
    param: "q",
    fields: ["name", "customerNumber"],
    placeholder: "Search name or customer #",
  },
  filters: [{ param: "accountStatus", control: "select" }],
  sort: {
    defaultBy: "name",
    defaultOrder: "asc",
    fields: ["name", "createdAt", "creditLimitCents", "customerNumber"],
  },
};

export const customerWriteBodySchema = z.object({
  name: z.string().min(1),
  creditLimitCents: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  terms: z.string().min(1),
  customerNumber: z.string().min(1).optional().nullable(),
  taxId: z.string().optional().nullable(),
  accountStatus: accountStatusSchema.optional(),
  customerNote: z.string().optional().nullable(),
  staffNote: z.string().optional().nullable(),
});

export const customerPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  creditLimitCents: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  terms: z.string().min(1).optional(),
  taxId: z.string().optional().nullable(),
  accountStatus: accountStatusSchema.optional(),
  customerNote: z.string().optional().nullable(),
  staffNote: z.string().optional().nullable(),
});

export const duplicateCustomerNumberResponseSchema = z.object({
  error: z.literal("duplicate_customer_number"),
});

export const wholesaleCustomerNotePatchBodySchema = z.object({
  customerNote: z.string().nullable(),
});

export const customerIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const contactWriteBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().optional().nullable(),
});

export const contactPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
});

export const contactItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
});

export const contactListResponseSchema = z.object({
  items: z.array(contactItemSchema),
});

export const contactParamsSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
});

export const shipToWriteBodySchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().min(1),
  postal: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const shipToPatchBodySchema = z.object({
  line1: z.string().min(1).optional(),
  line2: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  postal: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const shipToItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  region: z.string(),
  postal: z.string(),
  country: z.string(),
  isDefault: z.boolean(),
});

export const shipToListResponseSchema = z.object({
  items: z.array(shipToItemSchema),
});

export const shipToParamsSchema = z.object({
  id: z.string().uuid(),
  shipToId: z.string().uuid(),
});

export const wholesaleShipToParamsSchema = z.object({
  shipToId: z.string().uuid(),
});

export const billToWriteBodySchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  city: z.string().min(1),
  region: z.string().min(1),
  postal: z.string().min(1),
  country: z.string().min(1),
});

export const billToPatchBodySchema = z.object({
  line1: z.string().min(1).optional(),
  line2: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  postal: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
});

export const billToItemSchema = z.object({
  customerId: z.string().uuid(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  region: z.string(),
  postal: z.string(),
  country: z.string(),
});

export const billToAlreadyExistsResponseSchema = z.object({
  error: z.literal("already_exists"),
});

export const noDefaultShipToResponseSchema = z.object({
  error: z.literal("no_default_ship_to"),
});

export const exemptionWriteBodySchema = z.object({
  jurisdiction: z.string().min(1),
  status: z.string().min(1),
  entityUseCode: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  objectKey: z.string().optional().nullable(),
});

export const exemptionPatchBodySchema = z.object({
  jurisdiction: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  entityUseCode: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  objectKey: z.string().optional().nullable(),
});

export const exemptionItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  objectKey: z.string().nullable(),
  jurisdiction: z.string(),
  entityUseCode: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  status: z.string(),
});

export const wholesaleAccountDetailSchema = z.object({
  account: wholesaleCustomerItemSchema,
  shipTos: z.array(shipToItemSchema),
  billTo: billToItemSchema.nullable(),
  contacts: z.array(contactItemSchema),
  certificates: z.array(exemptionItemSchema),
});

export const exemptionListResponseSchema = z.object({
  items: z.array(exemptionItemSchema),
});

export const exemptionParamsSchema = z.object({
  id: z.string().uuid(),
  certificateId: z.string().uuid(),
});

export const productsListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "name", label: "Name" },
    { field: "listPrice", label: "List price" },
    { field: "lastPoCostCents", label: "Unit cost" },
    { field: "inactive", label: "Inactive" },
    { field: "discontinued", label: "Discontinued" },
    { field: "webWholesale", label: "Web wholesale" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [
    { param: "inactive", control: "boolean" },
    { param: "hideZeroInventory", control: "boolean" },
    { param: "category", control: "multiselect" },
    { param: "supplierId", control: "multiselect" },
    { param: "excludeSupplierId", control: "multiselect" },
    { param: "sellState", control: "select" },
  ],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: [...staffProductSortByValues],
  },
  export: { formats: ["csv"] as const },
};

export const productsExportQuerySchema = z.object({
  format: z.enum(["csv"]).default("csv"),
  q: z.string().optional(),
  sortBy: z.enum(staffProductSortByValues).default("sku"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  inactive: optionalBooleanQuery,
  hideZeroInventory: optionalBooleanQuery,
  category: optionalRepeatedQuery(z.string().trim().min(1)),
  supplierId: optionalRepeatedQuery(z.string().uuid()),
  sellState: sellStateSchema.optional(),
});

export const purchaseOrderStatusSchema = z.enum([
  "draft",
  "confirmed",
  "received",
  "cancelled",
]);

export const purchaseOrderLineSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  qty: z.number().int(),
  receivedQty: z.number().int(),
});

export const purchaseOrderItemSchema = z.object({
  id: z.string().uuid(),
  supplierId: z.string().uuid(),
  documentNumber: z.string(),
  status: purchaseOrderStatusSchema,
  shipDate: z.string().nullable(),
  cancelDate: z.string().nullable(),
  lines: z.array(purchaseOrderLineSchema),
});

export const sellWindowStatusSchema = z.enum(["scheduled", "open", "closed"]);

export const sellWindowFilterSnapshotSchema = z.object({
  q: z.string().optional(),
  category: z.array(z.string()).optional(),
  supplierId: z.array(z.string().uuid()).optional(),
  excludeSupplierId: z.array(z.string().uuid()).optional(),
});

export const reopenInventorySkusBodySchema = z.object({
  name: z.string().min(1),
  filterSnapshot: sellWindowFilterSnapshotSchema.default({}),
  skus: z.array(z.string().min(1)).min(1),
  windowOpensAt: z.string().datetime().nullable().optional(),
  windowClosesAt: z.string().datetime(),
});

export const reopenInventorySkusResponseSchema = z.object({
  reopenedCount: z.number().int().min(0),
  sellWindowId: z.string().uuid(),
  skuCount: z.number().int().min(0),
});

export const closeInventorySkusBodySchema = z
  .object({
    windowId: z.string().uuid().optional(),
    skus: z.array(z.string().min(1)).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.windowId === undefined && (value.skus === undefined || value.skus.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "windowId or skus is required",
      });
    }
  });

export const closeInventorySkusResponseSchema = z.object({
  closedCount: z.number().int().min(0),
});

export const sellWindowsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const sellWindowListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  filterSnapshot: sellWindowFilterSnapshotSchema,
  windowOpensAt: z.string().datetime().nullable(),
  windowClosesAt: z.string().datetime(),
  status: sellWindowStatusSchema,
  manuallyClosedAt: z.string().datetime().nullable(),
  appliedBy: z.string().uuid(),
  appliedAt: z.string().datetime(),
  skuCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const sellWindowsListResponseSchema = z.object({
  items: z.array(sellWindowListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const sellWindowsListTable = {
  rowId: "id",
  columns: [
    { field: "name", label: "Name" },
    { field: "status", label: "Status" },
    { field: "windowOpensAt", label: "Opens" },
    { field: "windowClosesAt", label: "Closes" },
    { field: "skuCount", label: "SKUs" },
    { field: "appliedAt", label: "Applied" },
  ],
};

export const sellWindowParamsSchema = z.object({
  id: z.string().uuid(),
});

export const sellWindowDetailSchema = sellWindowListItemSchema.extend({
  skus: z.array(z.string()),
});

export const draftUncoveredPurchaseOrdersBodySchema = z.object({
  skus: z.array(z.string().min(1)).min(1),
});

export const draftUncoveredPurchaseOrdersResponseSchema = z.object({
  purchaseOrders: z.array(purchaseOrderItemSchema),
  unmappedSkus: z.array(z.string()),
});

export const syncDraftPurchaseOrdersFromUncoveredBodySchema = z.object({
  supplierIds: z.array(z.string().uuid()).optional(),
});

export const syncDraftPurchaseOrdersFromUncoveredResponseSchema = z.object({
  purchaseOrderIds: z.array(z.string().uuid()),
  syncedSupplierIds: z.array(z.string().uuid()),
  clearedSupplierIds: z.array(z.string().uuid()),
  unmappedSkus: z.array(z.string()),
});

export const purchaseOrderListItemSchema = purchaseOrderItemSchema.extend({
  supplierName: z.string(),
  remaining: z.number().int(),
});

export const purchaseOrderListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z
    .enum([
      "documentNumber",
      "status",
      "supplierName",
      "shipDate",
      "cancelDate",
      "remaining",
    ])
    .default("documentNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  status: purchaseOrderStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
});

export const purchaseOrderListResponseSchema = z.object({
  items: z.array(purchaseOrderListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const purchaseOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const purchaseOrderDocumentNumberParamsSchema = z.object({
  documentNumber: z.string().min(1),
});

export const purchaseOrderExportQuerySchema = z.object({
  format: z.enum(["xlsx", "csv"]).default("xlsx"),
});

const factorySendBlankOrNumber = z.union([z.number(), z.literal("")]);

export const purchaseOrderFactorySendColumnSchema = z.object({
  key: z.string(),
  header: z.string(),
});

export const purchaseOrderFactorySendRowSchema = z.object({
  ship_date: z.string(),
  canc_date: z.string(),
  mat_num: z.string(),
  quan: z.number(),
  price: factorySendBlankOrNumber,
  extprice: factorySendBlankOrNumber,
  description: z.string(),
  mfg_code: z.string(),
  mfg_sku: z.string(),
  mfg_upc: z.string(),
  product_upc_1: z.string(),
  cs_cube_metric: z.number(),
  tot_cartons: factorySendBlankOrNumber,
  tot_cbm: z.string(),
  blocks_tot_cartons: z.boolean(),
});

export const purchaseOrderFactorySendResponseSchema = z.object({
  columns: z.array(purchaseOrderFactorySendColumnSchema),
  rows: z.array(purchaseOrderFactorySendRowSchema),
});

export const binaryFileResponseSchema = z.instanceof(Buffer);

export const purchaseOrderWriteBodySchema = z.object({
  supplierId: z.string().uuid(),
  shipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cancelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const purchaseOrderReplaceLinesBodySchema = z.object({
  shipDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  cancelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const purchaseOrderCommandBodySchema = z.object({
  idempotencyKey: z.string().min(1),
});

export const purchaseOrderReceiveBodySchema = z.object({
  idempotencyKey: z.string().min(1),
  lines: z
    .array(
      z.object({
        lineId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

export const purchaseOrderGoodsReceivedItemSchema = z.object({
  createdAt: z.string().datetime(),
  sku: z.string(),
  quantity: z.number().int().positive(),
});

export const purchaseOrderGoodsReceivedListResponseSchema = z.object({
  items: z.array(purchaseOrderGoodsReceivedItemSchema),
});

export const purchaseOrderShortReadoutUncoveredRowSchema = z.object({
  sku: z.string(),
  uncovered: z.number().int().nonnegative(),
});

export const purchaseOrderShortReadoutAffectedCustomerSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string(),
});

export const purchaseOrderShortReadoutResponseSchema = z.object({
  uncovered: z.array(purchaseOrderShortReadoutUncoveredRowSchema),
  affectedCustomers: z.array(purchaseOrderShortReadoutAffectedCustomerSchema),
});

export const conflictResponseSchema = z.object({
  error: z.literal("conflict"),
});

export const confirmPurchaseOrderConflictResponseSchema = z.object({
  error: z.enum([
    "illegal_transition",
    "product_not_found",
    "inventory_conflict",
    "idempotency_conflict",
    "provenance_conflict",
    "invalid_quantity",
  ]),
  sku: z.string().optional(),
  name: z.string().optional(),
});

export const purchaseOrdersListTable = {
  rowId: "id",
  columns: [
    { field: "documentNumber", label: "PO #" },
    { field: "status", label: "Status" },
    { field: "supplierName", label: "Supplier" },
  ],
  search: {
    param: "q",
    fields: ["documentNumber"],
    placeholder: "Search PO number",
  },
  filters: [
    { param: "status", control: "select" },
    { param: "supplierId", control: "text" },
  ],
  sort: {
    defaultBy: "documentNumber",
    defaultOrder: "asc",
    fields: [
      "documentNumber",
      "status",
      "supplierName",
      "shipDate",
      "cancelDate",
      "remaining",
    ],
  },
};

export const supplierListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["vendorNumber", "name"]).default("vendorNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const supplierPoPrefixSchema = z
  .string()
  .regex(/^[A-Z0-9]{2,4}$/)
  .nullable();

export const supplierItemSchema = z.object({
  id: z.string().uuid(),
  vendorNumber: z.string(),
  name: z.string(),
  poPrefix: supplierPoPrefixSchema,
});

export const supplierListResponseSchema = z.object({
  items: z.array(supplierItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const supplierWriteBodySchema = z.object({
  name: z.string().min(1),
  vendorNumber: z.string().min(1),
  poPrefix: supplierPoPrefixSchema.optional(),
});

export const supplierPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  vendorNumber: z.string().min(1).optional(),
  poPrefix: supplierPoPrefixSchema.optional(),
});

export const supplierIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const duplicateVendorNumberResponseSchema = z.object({
  error: z.literal("duplicate_vendor_number"),
});

export const duplicatePoPrefixResponseSchema = z.object({
  error: z.literal("duplicate_po_prefix"),
});

export const suppliersListTable = {
  rowId: "id",
  columns: [
    { field: "vendorNumber", label: "Vendor #" },
    { field: "name", label: "Name" },
    { field: "poPrefix", label: "PO prefix" },
  ],
  search: {
    param: "q",
    fields: ["vendorNumber", "name"],
    placeholder: "Search vendor # or name",
  },
  filters: [],
  sort: {
    defaultBy: "vendorNumber",
    defaultOrder: "asc",
    fields: ["vendorNumber", "name"],
  },
};

export const supplierProductListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["sku", "supplierSku"]).default("sku"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const supplierProductQtySchema = z.object({
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
  committed: z.number().int(),
  uncovered: z.number().int(),
});

export const supplierProductItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  catalogName: z.string(),
  supplierSku: z.string().nullable(),
  minOrderQty: z.number().int().nullable(),
  minOrderAmountCents: z.number().int().nullable(),
  lastPoCostCents: z.number().int().nullable(),
  currency: z.string().length(3),
  caseQty: z.number().int().positive().nullable(),
  qty: supplierProductQtySchema,
});

export const supplierProductWriteItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  supplierSku: z.string().nullable(),
  minOrderQty: z.number().int().nullable(),
  minOrderAmountCents: z.number().int().nullable(),
  lastPoCostCents: z.number().int().nullable(),
  currency: z.string().length(3),
});

export const supplierProductListResponseSchema = z.object({
  items: z.array(supplierProductItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const supplierProductWriteBodySchema = z.object({
  sku: z.string().min(1),
  supplierSku: z.string().nullable().optional(),
  minOrderQty: z.number().int().min(0).nullable().optional(),
  minOrderAmountCents: z.number().int().min(0).nullable().optional(),
  lastPoCostCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
});

export const supplierProductPatchBodySchema = z.object({
  supplierSku: z.string().nullable().optional(),
  minOrderQty: z.number().int().min(0).nullable().optional(),
  minOrderAmountCents: z.number().int().min(0).nullable().optional(),
  lastPoCostCents: z.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
});

export const supplierProductParamsSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
});

export const unknownSkuResponseSchema = z.object({
  error: z.literal("unknown_sku"),
});

export const supplierProductsListTable = {
  rowId: "id",
  columns: [
    { field: "sku", label: "SKU" },
    { field: "catalogName", label: "Product" },
    { field: "supplierSku", label: "Vendor item #" },
    { field: "minOrderQty", label: "Min qty" },
    { field: "minOrderAmountCents", label: "Min $ (¢)" },
    { field: "lastPoCostCents", label: "Last cost (¢)" },
    { field: "currency", label: "Currency" },
    { field: "qty.onHand", label: "On hand" },
    { field: "qty.onOrder", label: "On order" },
    { field: "qty.allocated", label: "Allocated" },
    { field: "qty.available", label: "Available" },
  ],
  search: {
    param: "q",
    fields: ["sku", "supplierSku"],
    placeholder: "Search SKU or vendor item #",
  },
  filters: [],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "supplierSku"],
  },
};

export const salesOrderStatusSchema = z.enum([
  "draft",
  "confirmed",
  "shipped",
  "cancelled",
]);

export const salesOrderLineSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid().optional(),
  sku: z.string(),
  name: z.string(),
  qty: z.number().int(),
  unitPriceCents: z.number().int(),
  currency: z.string().length(3),
  taxCategoryCode: z.string().optional(),
});

export const salesOrderItemSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  customerName: z.string().optional(),
  documentNumber: z.string(),
  status: salesOrderStatusSchema,
  label: z.string().optional(),
  creditLimitOverriddenByStaffUserId: z.string().uuid().optional(),
  shipLine1: z.string().optional(),
  shipLine2: z.string().nullable().optional(),
  shipCity: z.string().optional(),
  shipRegion: z.string().optional(),
  shipPostal: z.string().optional(),
  shipCountry: z.string().optional(),
  lines: z.array(salesOrderLineSchema),
});

export const salesOrderListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["documentNumber", "status"]).default("documentNumber"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  status: salesOrderStatusSchema.optional(),
  customerId: z.string().uuid().optional(),
});

export const salesOrderListResponseSchema = z.object({
  items: z.array(salesOrderItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const salesOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const salesOrderLineInputSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
});

const salesOrderAddressSchema = {
  shipLine1: z.string().optional(),
  shipLine2: z.string().nullable().optional(),
  shipCity: z.string().optional(),
  shipRegion: z.string().optional(),
  shipPostal: z.string().optional(),
  shipCountry: z.string().optional(),
};

export const salesOrderWriteBodySchema = z.object({
  customerId: z.string().uuid(),
  lines: z.array(salesOrderLineInputSchema).min(1),
  ...salesOrderAddressSchema,
});

/** Buyer-chosen cart name; blanks are dropped server-side. */
const salesOrderLabelSchema = z.string().trim().max(80);

export const wholesaleSalesOrderWriteBodySchema = z.object({
  lines: z
    .array(salesOrderLineInputSchema)
    .min(1),
  label: salesOrderLabelSchema.optional(),
  ...salesOrderAddressSchema,
});

export const salesOrderReplaceLinesBodySchema = z.object({
  lines: z.array(salesOrderLineInputSchema),
  /** Omit to keep the cart name; null clears it. */
  label: salesOrderLabelSchema.nullable().optional(),
  ...salesOrderAddressSchema,
});

const salesOrderLineDeltaAddSchema = z.object({
  productId: z.string().uuid(),
  /** Relative increment when the SKU is already on the draft; otherwise adds a new line. */
  qty: z.number().int().positive(),
});

const salesOrderLineDeltaUpdateSchema = z
  .object({
    lineId: z.string().uuid().optional(),
    sku: z.string().min(1).optional(),
    qty: z.number().int().positive(),
  })
  .refine((value) => value.lineId !== undefined || value.sku !== undefined, {
    message: "lineId or sku is required",
  });

export const salesOrderLineDeltasBodySchema = z.object({
  add: z.array(salesOrderLineDeltaAddSchema).optional(),
  update: z.array(salesOrderLineDeltaUpdateSchema).optional(),
  remove: z.array(z.string().min(1)).optional(),
});

export const salesOrderCommandBodySchema = z.object({
  idempotencyKey: z.string().min(1),
});

export const salesOrderConfirmBodySchema = salesOrderCommandBodySchema.extend({
  shipToId: z.string().uuid(),
});

export const salesOrderStaffConfirmBodySchema = salesOrderConfirmBodySchema.extend({
  overrideCredit: z.boolean().optional(),
});

export const insufficientAtpResponseSchema = z.object({
  error: z.literal("insufficient_atp"),
  sku: z.string().optional(),
  name: z.string().optional(),
  requestedQty: z.number().int().optional(),
  availableQty: z.number().int().optional(),
});

export const insufficientCoverResponseSchema = z.object({
  error: z.literal("insufficient_cover"),
  sku: z.string().optional(),
  name: z.string().optional(),
  requestedQty: z.number().int().optional(),
  coveredQty: z.number().int().optional(),
});

export const shipRefusedResponseSchema = z.object({
  error: z.enum(["bill_to_missing", "accounting_invalid", "illegal_transition"]),
});

export const creditExceededResponseSchema = z.object({
  error: z.literal("credit_exceeded"),
  availableCreditCents: z.number().int().optional(),
  orderTotalCents: z.number().int().optional(),
});

export const salesOrdersListTable = {
  rowId: "id",
  columns: [
    { field: "documentNumber", label: "SO #" },
    { field: "status", label: "Status" },
    { field: "customerName", label: "Customer" },
  ],
  search: {
    param: "q",
    fields: ["documentNumber"],
    placeholder: "Search SO number",
  },
  filters: [
    { param: "status", control: "select" },
    { param: "customerId", control: "text" },
  ],
  sort: {
    defaultBy: "documentNumber",
    defaultOrder: "asc",
    fields: ["documentNumber", "status"],
  },
};

export const invoiceStatusSchema = z.enum(["unposted", "posted"]);

export const invoiceItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  documentNumber: z.string(),
  status: invoiceStatusSchema,
  postedAt: z.coerce.date().nullable(),
  subtotalCents: z.number().int(),
  taxTotalCents: z.number().int(),
  totalCents: z.number().int(),
  remainingCents: z.number().int(),
  currency: z.string().length(3),
});

export const invoiceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const recordPaymentBodySchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(1),
});

export const recordPaymentResponseSchema = z.object({
  remainingCents: z.number().int(),
  currency: z.string().length(3),
});

export const overpayResponseSchema = z.object({
  error: z.literal("overpay"),
});

export const wrongCurrencyResponseSchema = z.object({
  error: z.literal("wrong_currency"),
});

export const paymentMethodSchema = z.enum(["check", "card", "ach", "cash", "other"]);

export const arInvoiceStatusSchema = z.enum(["paid", "past_due", "partial", "open"]);

export const agingBucketSchema = z.enum([
  "current",
  "1-15",
  "16-30",
  "31-45",
  "46-60",
  "61-90",
  "90+",
]);

export const invoiceAdjustmentKindSchema = z.enum(["write_off", "credit_memo"]);

export const paymentPlanFrequencySchema = z.enum(["weekly", "monthly"]);

export const customerAccountingQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
});

export const customerInvoicesQuerySchema = z.object({
  includePaid: optionalBooleanQuery,
  asOf: z.coerce.date().optional(),
});

export const customerArInvoiceItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  documentNumber: z.string(),
  postedAt: z.coerce.date().nullable(),
  dueDate: z.coerce.date().nullable(),
  terms: z.string().nullable(),
  totalCents: z.number().int(),
  remainingCents: z.number().int(),
  currency: z.string().length(3),
  status: arInvoiceStatusSchema,
});

export const customerArInvoiceListResponseSchema = z.object({
  items: z.array(customerArInvoiceItemSchema),
});

export const customerPaymentApplicationItemSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  createdAt: z.coerce.date(),
});

export const customerPaymentItemSchema = z.object({
  id: z.string().uuid(),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  method: paymentMethodSchema,
  reference: z.string().nullable(),
  note: z.string().nullable(),
  receivedAt: z.coerce.date(),
  appliedCents: z.number().int(),
  unappliedCents: z.number().int(),
  voided: z.boolean(),
  voidReason: z.string().nullable(),
  applications: z.array(customerPaymentApplicationItemSchema),
});

export const customerPaymentListResponseSchema = z.object({
  items: z.array(customerPaymentItemSchema),
});

export const customerArStatsSchema = z.object({
  highestInvoiceCents: z.number().int(),
  avgInvoiceCents: z.number().int(),
  openInvoiceCount: z.number().int(),
  totalOpenInvoiceAmountCents: z.number().int(),
  creditMemoCount: z.number().int(),
  totalCreditMemoCents: z.number().int(),
  totalWriteOffsCents: z.number().int(),
  openBalanceCents: z.number().int(),
  creditLimitCents: z.number().int(),
  availableCreditCents: z.number().int(),
  unappliedCreditCents: z.number().int(),
  dateOfFirstShipment: z.coerce.date().nullable(),
  dateOfLastShipment: z.coerce.date().nullable(),
  dateOfLastOrder: z.coerce.date().nullable(),
  avgDaysToPay: z.number().nullable(),
  lastYtdSalesCents: z.number().int(),
  ytdSalesCents: z.number().int(),
  lytdVsYtdPercent: z.number().nullable(),
  lastYearSalesCents: z.number().int(),
  totalSalesCents: z.number().int(),
});

export const paymentPlanItemSchema = z.object({
  id: z.string().uuid(),
  frequency: paymentPlanFrequencySchema,
  installmentAmountCents: z.number().int(),
  currency: z.string().length(3),
  startsOn: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const paymentPlanExpectationsSchema = z.object({
  nextExpectedOn: z.coerce.date().nullable(),
  estimatedEndOn: z.coerce.date().nullable(),
  installmentsReceived: z.number().int(),
  installmentsExpectedSoFar: z.number().int(),
  missedInstallments: z.number().int(),
  complete: z.boolean(),
});

export const agingBucketsSchema = z.object({
  current: z.number().int(),
  "1-15": z.number().int(),
  "16-30": z.number().int(),
  "31-45": z.number().int(),
  "46-60": z.number().int(),
  "61-90": z.number().int(),
  "90+": z.number().int(),
});

export const customerAccountingSummarySchema = z.object({
  asOf: z.coerce.date(),
  aging: agingBucketsSchema,
  unappliedCreditCents: z.number().int(),
  openBalanceCents: z.number().int(),
  openBalanceOwedCents: z.number().int(),
  exposureCents: z.number().int(),
  availableCreditCents: z.number().int(),
  stats: customerArStatsSchema,
  plan: paymentPlanItemSchema.nullable(),
  planExpectations: paymentPlanExpectationsSchema.nullable(),
});

export const customerAccountingWorkspaceResponseSchema = z.object({
  summary: customerAccountingSummarySchema,
  invoices: z.array(customerArInvoiceItemSchema),
  payments: z.array(customerPaymentItemSchema),
});

export const recordCustomerPaymentApplicationBodySchema = z.object({
  invoiceId: z.string().uuid(),
  amountCents: z.number().int().positive(),
});

export const recordCustomerPaymentBodySchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  method: paymentMethodSchema,
  reference: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  receivedAt: z.coerce.date().optional(),
  idempotencyKey: z.string().min(1),
  holdRemainderAsCredit: z.boolean(),
  applications: z.array(recordCustomerPaymentApplicationBodySchema),
});

export const recordCustomerPaymentResponseSchema = z.object({
  paymentId: z.string().uuid(),
  unappliedCents: z.number().int(),
  remainingByInvoiceId: z.record(z.string(), z.number().int()),
});

export const reallocatePaymentApplicationBodySchema = z.object({
  invoiceId: z.string().uuid(),
  deltaCents: z.number().int().refine((value) => value !== 0, "deltaCents must be non-zero"),
});

export const reallocatePaymentBodySchema = z.object({
  applications: z.array(reallocatePaymentApplicationBodySchema).min(1),
});

export const reallocatePaymentResponseSchema = z.object({
  unappliedCents: z.number().int(),
});

export const voidPaymentBodySchema = z.object({
  voidReason: z.string().min(1),
});

export const voidPaymentResponseSchema = z.object({
  unappliedCents: z.number().int(),
});

export const adjustInvoiceBodySchema = z.object({
  kind: invoiceAdjustmentKindSchema,
  amountCents: z.number().int().refine((value) => value !== 0, "amountCents must be non-zero"),
  reason: z.string().min(1),
});

export const adjustInvoiceResponseSchema = z.object({
  remainingCents: z.number().int(),
});

export const setPaymentPlanBodySchema = z.object({
  frequency: paymentPlanFrequencySchema,
  installmentAmountCents: z.number().int().positive(),
  currency: z.string().length(3),
  startsOn: z.coerce.date(),
});

export const accountingSummaryQuerySchema = z.object({
  asOf: z.coerce.date().optional(),
});

export const accountingSummaryResponseSchema = z.object({
  asOf: z.coerce.date(),
  totalOpenArCents: z.number().int(),
  pastDuePercent: z.number().int(),
  pastDueCents: z.number().int(),
  unappliedCreditCents: z.number().int(),
  mtdWriteOffsCents: z.number().int(),
  aging: agingBucketsSchema,
});

export const customerBalancesSortByValues = [
  "pastDueCents",
  "openBalanceCents",
  "name",
  "customerNumber",
  "oldestDueDate",
  "daysPastDue",
  "creditLimitCents",
  "availableCreditCents",
] as const;

export const customerBalancesListQuerySchema = z.object({
  asOf: z
    .string()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(new Date(value).getTime()), {
      message: "Invalid date",
    }),
  bucket: agingBucketSchema.optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(customerBalancesSortByValues).default("pastDueCents"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const customerBalanceItemSchema = z.object({
  customerId: z.string().uuid(),
  customerNumber: z.string(),
  name: z.string(),
  openBalanceCents: z.number().int(),
  pastDueCents: z.number().int(),
  oldestDueDate: z.coerce.date().nullable(),
  daysPastDue: z.number().int(),
  creditLimitCents: z.number().int(),
  availableCreditCents: z.number().int(),
  hasActivePlan: z.boolean(),
});

export const customerBalancesListResponseSchema = z.object({
  items: z.array(customerBalanceItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const customerBalancesListTable = {
  rowId: "customerId",
  columns: [
    { field: "name", label: "Customer" },
    { field: "customerNumber", label: "Customer #" },
    { field: "openBalanceCents", label: "Open balance" },
    { field: "pastDueCents", label: "Past due" },
    { field: "oldestDueDate", label: "Oldest due" },
    { field: "daysPastDue", label: "Days past due" },
    { field: "creditLimitCents", label: "Credit limit" },
    { field: "availableCreditCents", label: "Available credit" },
    { field: "hasActivePlan", label: "Plan" },
  ],
  search: {
    param: "q",
    fields: ["name", "customerNumber"],
    placeholder: "Search customer name or #",
  },
  filters: [
    { param: "asOf", control: "date" },
    { param: "bucket", control: "select" },
  ],
  sort: {
    defaultBy: "pastDueCents",
    defaultOrder: "desc",
    fields: [...customerBalancesSortByValues],
  },
};

export const paymentsReceivedSortByValues = [
  "receivedAt",
  "amountCents",
  "customerName",
] as const;

export const paymentsReceivedListQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(paymentsReceivedSortByValues).default("receivedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const paymentReceivedItemSchema = z.object({
  paymentId: z.string().uuid(),
  receivedAt: z.coerce.date(),
  customerId: z.string().uuid(),
  customerNumber: z.string(),
  customerName: z.string(),
  amountCents: z.number().int(),
  currency: z.string().length(3),
  method: paymentMethodSchema,
  reference: z.string().nullable(),
  note: z.string().nullable(),
  voidReason: z.string().nullable(),
  appliedCents: z.number().int(),
  unappliedCents: z.number().int(),
  voided: z.boolean(),
  applications: z.array(customerPaymentApplicationItemSchema),
});

export const paymentsReceivedListResponseSchema = z.object({
  items: z.array(paymentReceivedItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const paymentsReceivedListTable = {
  rowId: "paymentId",
  filters: [{ param: "from", control: "dateRange", rangePair: "to" }],
  columns: [
    { field: "receivedAt", label: "Received" },
    { field: "customerName", label: "Customer" },
    { field: "amountCents", label: "Amount" },
    { field: "method", label: "Method" },
    { field: "reference", label: "Reference" },
    { field: "appliedCents", label: "Applied" },
    { field: "unappliedCents", label: "Unapplied" },
    { field: "voided", label: "Voided" },
  ],
  sort: {
    defaultBy: "receivedAt",
    defaultOrder: "desc",
    fields: [...paymentsReceivedSortByValues],
  },
};

export const paymentIdParamsSchema = z.object({
  id: z.string().uuid(),
});
