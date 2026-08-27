import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const unauthorizedResponseSchema = z.object({
  error: z.literal("unauthorized"),
});

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});

export const staffSessionResponseSchema = z.object({
  staffUserId: z.string().uuid(),
  email: z.string(),
  organizationId: z.string(),
});

export const wholesaleSessionResponseSchema = z.object({
  wholesaleUserId: z.string().uuid(),
  email: z.string(),
  customerId: z.string().uuid(),
  organizationId: z.string(),
});

const optionalBooleanQuery = z
  .union([z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    return value === true || value === "true";
  });

export const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["sku", "name", "onHand", "available", "createdAt"]).default("sku"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  inactive: optionalBooleanQuery,
});

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  memberPrice: z.number().int(),
  currency: z.string(),
  inactive: z.boolean(),
  discontinued: z.boolean(),
  webWholesale: z.boolean(),
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
  createdAt: z.string().datetime(),
});

export const productListResponseSchema = z.object({
  items: z.array(productListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["name", "available"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const catalogItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  wholesalePrice: z.number().int(),
  currency: z.string(),
  available: z.number().int(),
});

export const catalogListResponseSchema = z.object({
  items: z.array(catalogItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const opsSubscriptionSchema = z.object({
  status: z.enum(["trialing", "active", "inactive"]),
  plan: z.string().nullable(),
});

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const productWriteBodySchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  uom: z.string().min(1),
  memberPriceCents: z.number().int(),
  currency: z.string().length(3).optional(),
  inactive: z.boolean().optional(),
  discontinued: z.boolean().optional(),
  webWholesale: z.boolean().optional(),
  description: z.string().optional().nullable(),
  taxCategoryCode: z.string().optional().nullable(),
});

export const productPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  uom: z.string().min(1).optional(),
  memberPriceCents: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  inactive: z.boolean().optional(),
  discontinued: z.boolean().optional(),
  webWholesale: z.boolean().optional(),
  description: z.string().optional().nullable(),
  taxCategoryCode: z.string().optional().nullable(),
});

export const productDetailSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  uom: z.string(),
  memberPriceCents: z.number().int(),
  currency: z.string(),
  inactive: z.boolean(),
  discontinued: z.boolean(),
  webWholesale: z.boolean(),
  taxCategoryCode: z.string().nullable(),
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
});

export const duplicateSkuResponseSchema = z.object({
  error: z.literal("duplicate_sku"),
});

export const skuImmutableResponseSchema = z.object({
  error: z.literal("sku_immutable"),
});

export const qtyNotAllowedResponseSchema = z.object({
  error: z.literal("qty_not_allowed"),
});

export const stubOpsSubscription = {
  status: "inactive" as const,
  plan: null,
};

export const licensingSubscriptionItemSchema = z.object({
  id: z.string().uuid(),
  plan: z.string(),
  status: z.enum(["trialing", "active", "past_due", "canceled"]),
});

export const licensingSubscriptionListResponseSchema = z.object({
  items: z.array(licensingSubscriptionItemSchema),
});

export const licensingPaymentItemSchema = z.object({
  id: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  providerRef: z.string(),
  amountCents: z.number().int(),
});

export const licensingPaymentListResponseSchema = z.object({
  items: z.array(licensingPaymentItemSchema),
});

export const notFoundResponseSchema = z.object({
  error: z.literal("not_found"),
});

export const invalidResponseSchema = z.object({
  error: z.literal("invalid"),
});

export const zodValidationErrorResponseSchema = z.object({
  statusCode: z.number(),
  code: z.string(),
  error: z.string(),
  message: z.string(),
});

export const duplicateEmailResponseSchema = z.object({
  error: z.literal("duplicate_email"),
});

export const customerListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["name", "createdAt", "creditLimitCents"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const customerItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  creditLimitCents: z.number().int(),
  currency: z.string(),
  terms: z.string(),
});

export const customerListResponseSchema = z.object({
  items: z.array(customerItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const customerWriteBodySchema = z.object({
  name: z.string().min(1),
  creditLimitCents: z.number().int(),
  currency: z.string().length(3).optional(),
  terms: z.string().min(1),
});

export const customerPatchBodySchema = z.object({
  name: z.string().min(1).optional(),
  creditLimitCents: z.number().int().optional(),
  currency: z.string().length(3).optional(),
  terms: z.string().min(1).optional(),
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
    { field: "memberPrice", label: "Member price" },
    { field: "currency", label: "Currency" },
    { field: "inactive", label: "Inactive" },
    { field: "discontinued", label: "Discontinued" },
    { field: "webWholesale", label: "Web wholesale" },
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "available", label: "Available" },
    { field: "createdAt", label: "Created" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [{ param: "inactive", control: "boolean" }],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "name", "onHand", "available", "createdAt"],
  },
};

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
  lines: z.array(purchaseOrderLineSchema),
});

export const purchaseOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: purchaseOrderStatusSchema.optional(),
  supplierId: z.string().uuid().optional(),
});

export const purchaseOrderListResponseSchema = z.object({
  items: z.array(purchaseOrderItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const purchaseOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const purchaseOrderWriteBodySchema = z.object({
  supplierId: z.string().uuid(),
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

export const conflictResponseSchema = z.object({
  error: z.literal("conflict"),
});

export const purchaseOrdersListTable = {
  rowId: "id",
  columns: [
    { field: "documentNumber", label: "PO #" },
    { field: "status", label: "Status" },
    { field: "supplierId", label: "Supplier" },
  ],
  sort: {
    defaultBy: "documentNumber",
    defaultOrder: "asc",
    fields: ["documentNumber", "status"],
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
  documentNumber: z.string(),
  status: salesOrderStatusSchema,
  shipLine1: z.string().optional(),
  shipLine2: z.string().nullable().optional(),
  shipCity: z.string().optional(),
  shipRegion: z.string().optional(),
  shipPostal: z.string().optional(),
  shipCountry: z.string().optional(),
  lines: z.array(salesOrderLineSchema),
});

export const salesOrderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
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

export const salesOrderWriteBodySchema = z.object({
  customerId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        sku: z.string().min(1),
        name: z.string().min(1),
        qty: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
        currency: z.string().length(3),
        taxCategoryCode: z.string().optional(),
      }),
    )
    .min(1),
  shipLine1: z.string().optional(),
  shipLine2: z.string().nullable().optional(),
  shipCity: z.string().optional(),
  shipRegion: z.string().optional(),
  shipPostal: z.string().optional(),
  shipCountry: z.string().optional(),
});

export const salesOrderCommandBodySchema = z.object({
  idempotencyKey: z.string().min(1),
});

export const insufficientAtpResponseSchema = z.object({
  error: z.literal("insufficient_atp"),
});

export const salesOrdersListTable = {
  rowId: "id",
  columns: [
    { field: "documentNumber", label: "SO #" },
    { field: "status", label: "Status" },
    { field: "customerId", label: "Customer" },
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
