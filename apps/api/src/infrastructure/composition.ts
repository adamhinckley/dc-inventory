import { SystemClock } from "../adapters/system-clock.js";
import { PingUseCase } from "../application/ping.js";
import type { IClock } from "../domain/clock.js";
import { featuresAllCoreOn, type IFeatures } from "../features.js";

/**
 * Composition root services. Domain/application never import this file —
 * only `app.ts` / `server.ts` wire ports to adapters here.
 */
export type AppServices = {
  features: IFeatures;
  clock: IClock;
  ping: PingUseCase;
};

export type AppServiceOverrides = {
  features?: IFeatures;
  clock?: IClock;
};

export function composeAppServices(
  overrides: AppServiceOverrides = {},
): AppServices {
  const features = overrides.features ?? featuresAllCoreOn();
  const clock = overrides.clock ?? new SystemClock();
  return {
    features,
    clock,
    ping: new PingUseCase(clock),
  };
}
