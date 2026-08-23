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
