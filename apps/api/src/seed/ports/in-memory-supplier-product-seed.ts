import type {
  ISupplierProductSeedRepository,
  SupplierProductSeedRow,
} from "./static-seed-types.js";

export class InMemorySupplierProductSeedRepository implements ISupplierProductSeedRepository {
  private readonly rows: SupplierProductSeedRow[] = [];

  async save(row: SupplierProductSeedRow): Promise<void> {
    const index = this.rows.findIndex(
      (item) => item.supplierId === row.supplierId && item.sku === row.sku,
    );
    if (index >= 0) {
      this.rows[index] = row;
      return;
    }
    this.rows.push(row);
  }

  async listAll(): Promise<readonly SupplierProductSeedRow[]> {
    return [...this.rows];
  }
}
