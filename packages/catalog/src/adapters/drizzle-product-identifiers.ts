import { ProductId } from "@dc-inventory/shared-kernel";
import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { newUuid } from "../domain/ids.js";
import type {
  IProductIdentifierRepository,
  ProductIdentifier,
  ProductIdentifierAssignment,
  ProductIdentifierKind,
} from "../domain/ports/product-identifiers.js";
import { productIdentifiers } from "../persistence/schema.js";

const IMPORT_BATCH_SIZE = 500;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

export type CatalogIdentifiersDrizzle = PostgresJsDatabase<{
  productIdentifiers: typeof productIdentifiers;
}>;

export class DrizzleProductIdentifierRepository implements IProductIdentifierRepository {
  constructor(private readonly db: CatalogIdentifiersDrizzle) {}

  async findByProductId(productId: ProductId): Promise<readonly ProductIdentifier[]> {
    const rows = await this.db
      .select({
        kind: productIdentifiers.kind,
        code: productIdentifiers.code,
      })
      .from(productIdentifiers)
      .where(eq(productIdentifiers.productId, productId));
    return rows.map((row) => ({
      productId,
      kind: row.kind as ProductIdentifierKind,
      code: row.code,
    }));
  }

  async replaceForProducts(assignments: readonly ProductIdentifierAssignment[]): Promise<void> {
    if (assignments.length === 0) {
      return;
    }
    for (const batch of chunks(assignments, IMPORT_BATCH_SIZE)) {
      const productIds = batch.map((assignment) => assignment.productId);
      await this.db
        .delete(productIdentifiers)
        .where(inArray(productIdentifiers.productId, [...productIds]));

      const rows: Array<typeof productIdentifiers.$inferInsert> = [];
      for (const assignment of batch) {
        const seen = new Set<string>();
        for (const identifier of assignment.identifiers) {
          const key = `${identifier.kind}:${identifier.code}`;
          if (seen.has(key)) {
            continue;
          }
          seen.add(key);
          rows.push({
            id: newUuid(),
            productId: identifier.productId,
            kind: identifier.kind,
            code: identifier.code,
          });
        }
      }
      if (rows.length > 0) {
        await this.db.insert(productIdentifiers).values(rows).onConflictDoNothing();
      }
    }
  }
}
