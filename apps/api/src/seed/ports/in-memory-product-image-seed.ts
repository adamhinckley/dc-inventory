import type { IProductImageSeedRepository, ProductImageSeedRow } from "./static-seed-types.js";

export class InMemoryProductImageSeedRepository implements IProductImageSeedRepository {
  private readonly rows: ProductImageSeedRow[] = [];

  async save(row: ProductImageSeedRow): Promise<void> {
    const index = this.rows.findIndex((item) => item.productId === row.productId);
    if (index >= 0) {
      this.rows[index] = row;
      return;
    }
    this.rows.push(row);
  }

  async listAll(): Promise<readonly ProductImageSeedRow[]> {
    return [...this.rows];
  }
}
