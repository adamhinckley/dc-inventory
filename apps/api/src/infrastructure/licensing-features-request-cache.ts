import { LicensingFeatures } from "@dc-inventory/licensing";
import type { FastifyInstance } from "fastify";

export function registerLicensingFeaturesRequestCache(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    const features = request.server.features;
    if (features instanceof LicensingFeatures) {
      features.clearRequestCache();
    }
  });
}
