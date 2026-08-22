import { z } from "zod";

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
