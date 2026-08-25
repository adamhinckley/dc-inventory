import type { DemoOwnedSchema } from "./constants.js";

export type DemoBookOccupancy = {
  occupied: boolean;
  /** First table that contained a row, when occupied. */
  location?: `${DemoOwnedSchema}.${string}`;
};

export interface IDemoBookOccupancyPort {
  checkOccupancy(): Promise<DemoBookOccupancy>;
}

export interface IDemoBookResetPort {
  resetDemoOwnedSchemas(): Promise<void>;
}
