import type {
  IReorderPolicySeedRepository,
  ReorderPolicySeedRow,
} from "./static-seed-types.js";

export class InMemoryReorderPolicySeedRepository implements IReorderPolicySeedRepository {
  private readonly rows: ReorderPolicySeedRow[] = [];

  async save(row: ReorderPolicySeedRow): Promise<void> {
    const index = this.rows.findIndex(
      (item) => item.sku === row.sku && item.locationId === row.locationId,
    );
    if (index >= 0) {
      this.rows[index] = row;
      return;
    }
    this.rows.push(row);
  }

  async listAll(): Promise<readonly ReorderPolicySeedRow[]> {
    return [...this.rows];
  }
}
