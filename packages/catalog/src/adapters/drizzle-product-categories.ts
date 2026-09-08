import { OrganizationId, ProductId } from "@dc-inventory/shared-kernel";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
  IProductCategoryRepository,
  ProductCategoryAssignment,
} from "../domain/ports/product-categories.js";
import { categories, productCategories } from "../persistence/schema.js";

const IMPORT_BATCH_SIZE = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export type CatalogCategoriesDrizzle = PostgresJsDatabase<{
  categories: typeof categories;
  productCategories: typeof productCategories;
}>;

export class DrizzleProductCategoryRepository implements IProductCategoryRepository {
  constructor(private readonly db: CatalogCategoriesDrizzle) {}

  async listNamesForProduct(
    organizationId: OrganizationId,
    productId: ProductId,
  ): Promise<readonly string[]> {
    const rows = await this.db
      .select({ name: categories.name })
      .from(productCategories)
      .innerJoin(categories, eq(productCategories.categoryId, categories.id))
      .where(
        and(
          eq(productCategories.productId, productId),
          eq(categories.organizationId, organizationId),
        ),
      )
      .orderBy(asc(productCategories.slot));
    return rows.map((row) => row.name);
  }

  async replaceForProducts(
    organizationId: OrganizationId,
    assignments: readonly ProductCategoryAssignment[],
  ): Promise<void> {
    if (assignments.length === 0) {
      return;
    }

    const uniqueNames = [
      ...new Set(
        assignments.flatMap((assignment) =>
          assignment.categoryNames
            .map((name) => name.trim())
            .filter((name) => name.length > 0),
        ),
      ),
    ];

    if (uniqueNames.length > 0) {
      await this.db
        .insert(categories)
        .values(
          uniqueNames.map((name) => ({
            organizationId,
            name,
          })),
        )
        .onConflictDoNothing();
    }

    const categoryRows =
      uniqueNames.length === 0
        ? []
        : await this.db
            .select({ id: categories.id, name: categories.name })
            .from(categories)
            .where(
              and(
                eq(categories.organizationId, organizationId),
                inArray(categories.name, uniqueNames),
              ),
            );

    const categoryIdByName = new Map(categoryRows.map((row) => [row.name, row.id]));

    for (const batch of chunks(assignments, IMPORT_BATCH_SIZE)) {
      const productIds = batch.map((assignment) => assignment.productId);
      await this.db
        .delete(productCategories)
        .where(inArray(productCategories.productId, productIds));

      const links: Array<{ productId: ProductId; categoryId: string; slot: number }> = [];
      for (const assignment of batch) {
        const seen = new Set<string>();
        let slot = 1;
        for (const rawName of assignment.categoryNames) {
          const name = rawName.trim();
          if (name.length === 0 || seen.has(name)) {
            continue;
          }
          seen.add(name);
          const categoryId = categoryIdByName.get(name);
          if (categoryId !== undefined) {
            links.push({ productId: assignment.productId, categoryId, slot });
            slot += 1;
          }
        }
      }

      if (links.length > 0) {
        await this.db.insert(productCategories).values(links).onConflictDoNothing();
      }
    }
  }
}
