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
});

export const wholesaleSessionResponseSchema = z.object({
  wholesaleUserId: z.string().uuid(),
  email: z.string(),
  customerId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["sku", "name", "available", "createdAt"]).default("sku"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  status: z.enum(["active", "inactive"]).optional(),
});

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  name: z.string(),
  onHand: z.number().int(),
  onOrder: z.number().int(),
  allocated: z.number().int(),
  available: z.number().int(),
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

export const emptyProductList = {
  items: [] as z.infer<typeof productListItemSchema>[],
  page: 1,
  pageSize: 25,
  total: 0,
};

export const emptyCatalogList = {
  items: [] as z.infer<typeof catalogItemSchema>[],
  page: 1,
  pageSize: 25,
  total: 0,
};

/** Stub rows so the wholesale shop can render an example product-card list. */
export const stubCatalogList = {
  items: [
    {
      id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      name: "Galvanized hex bolt",
      imageUrl: null,
      wholesalePrice: 1250,
      currency: "USD",
      available: 48,
    },
    {
      id: "2f1a0b8c-3d4e-4f5a-8b6c-7d8e9f0a1b2c",
      name: "Stainless washer pack",
      imageUrl: null,
      wholesalePrice: 475,
      currency: "USD",
      available: 120,
    },
    {
      id: "0a1b2c3d-4e5f-4678-89ab-cdef01234567",
      name: "Nylon lock nut",
      imageUrl: null,
      wholesalePrice: 89,
      currency: "USD",
      available: 0,
    },
  ],
  page: 1,
  pageSize: 25,
  total: 3,
} satisfies z.infer<typeof catalogListResponseSchema>;

export const stubOpsSubscription = {
  status: "inactive" as const,
  plan: null,
};

export const notFoundResponseSchema = z.object({
  error: z.literal("not_found"),
});

export const invalidResponseSchema = z.object({
  error: z.literal("invalid"),
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
    { field: "onHand", label: "On hand" },
    { field: "onOrder", label: "On order" },
    { field: "allocated", label: "Allocated" },
    { field: "available", label: "Available" },
  ],
  search: {
    param: "q",
    fields: ["sku", "name"],
    placeholder: "Search SKU or name",
  },
  filters: [{ param: "status", control: "select" }],
  sort: {
    defaultBy: "sku",
    defaultOrder: "asc",
    fields: ["sku", "name", "available", "createdAt"],
  },
};
