import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { evaluateFeature, type FeatureName } from "../domain/features.js";
import type { IFeatures } from "../domain/ports/features.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";
import { getLicensingFeatureStateCache } from "./licensing-feature-state-cache.js";

export class LicensingFeatures implements IFeatures {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async isEnabled(organizationId: OrganizationId, name: FeatureName): Promise<boolean> {
    const cache = getLicensingFeatureStateCache();
    if (cache === undefined) {
      return evaluateFeature(await this.repository.getFeatureState(organizationId), name);
    }

    let state = cache.get(organizationId);
    if (state === undefined) {
      state = await this.repository.getFeatureState(organizationId);
      cache.set(organizationId, state);
    }
    return evaluateFeature(state, name);
  }
}
