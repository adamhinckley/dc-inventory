import {
  LicensingFeatures,
  runWithLicensingFeatureStateCache,
} from "@dc-inventory/licensing";
import type { FastifyInstance } from "fastify";

export function registerLicensingFeaturesRequestCache(app: FastifyInstance): void {
  app.addHook("onRequest", (request, reply, done) => {
    if (!(request.server.features instanceof LicensingFeatures)) {
      done();
      return;
    }
    try {
      runWithLicensingFeatureStateCache(() => {
        done();
      });
    } catch (error) {
      done(error as Error);
    }
  });
}
