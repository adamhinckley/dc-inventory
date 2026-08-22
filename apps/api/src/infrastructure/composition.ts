import { SystemClock } from "../adapters/system-clock.js";
import { PingUseCase } from "../application/ping.js";
import { ReadyCheckUseCase } from "../application/ready.js";
import type { IClock } from "../domain/clock.js";
import type { IDatabase } from "../domain/database.js";
import { featuresAllCoreOn, type IFeatures } from "../features.js";
import { createPostgresDatabase } from "./db.js";

/**
 * Composition root services. Domain/application never import this file —
 * only `app.ts` / `server.ts` wire ports to adapters here.
 */
export type AppServices = {
  features: IFeatures;
  clock: IClock;
  database: IDatabase;
  ping: PingUseCase;
  ready: ReadyCheckUseCase;
};

export type AppServiceOverrides = {
  features?: IFeatures;
  clock?: IClock;
  database?: IDatabase;
};

export function composeAppServices(
  overrides: AppServiceOverrides = {},
): AppServices {
  const features = overrides.features ?? featuresAllCoreOn();
  const clock = overrides.clock ?? new SystemClock();
  const database = overrides.database ?? createPostgresDatabase();
  return {
    features,
    clock,
    database,
    ping: new PingUseCase(clock),
    ready: new ReadyCheckUseCase(database),
  };
}
