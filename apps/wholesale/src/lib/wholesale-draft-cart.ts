/**
 * One query feeds every cart surface: header badge, drawer, /cart list, add-to-cart.
 * A customer may hold many open drafts (multi-cart); newest document first.
 */
export const wholesaleDraftCartParams = {
  status: "draft",
  page: 1,
  pageSize: 50,
  sortBy: "documentNumber",
  sortOrder: "desc",
} as const;
