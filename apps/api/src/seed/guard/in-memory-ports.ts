import { DEMO_OWNED_SCHEMAS } from "./constants.js";
import type { DemoOwnedSchema } from "./constants.js";
import type {
  DemoBookOccupancy,
  IDemoBookOccupancyPort,
  IDemoBookResetPort,
} from "./ports.js";

type OccupiedTable = `${DemoOwnedSchema}.${string}`;

export class InMemoryDemoBookOccupancy implements IDemoBookOccupancyPort {
  private readonly occupiedTables = new Set<OccupiedTable>();

  seedOccupied(location: OccupiedTable): void {
    this.occupiedTables.add(location);
  }

  async checkOccupancy(): Promise<DemoBookOccupancy> {
    const [first] = [...this.occupiedTables];
    if (!first) {
      return { occupied: false };
    }
    return { occupied: true, location: first };
  }

  clearDemoOwned(): void {
    for (const table of [...this.occupiedTables]) {
      const schema = table.split(".", 1)[0] as DemoOwnedSchema;
      if ((DEMO_OWNED_SCHEMAS as readonly string[]).includes(schema)) {
        this.occupiedTables.delete(table);
      }
    }
  }
}

export class InMemoryDemoBookReset implements IDemoBookResetPort {
  constructor(private readonly occupancy: InMemoryDemoBookOccupancy) {}

  async resetDemoOwnedSchemas(): Promise<void> {
    this.occupancy.clearDemoOwned();
  }
}
