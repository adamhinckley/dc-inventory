import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { evaluateFeature, type FeatureName } from "../domain/features.js";
import type { IFeatures } from "../domain/ports/features.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";

export class LicensingFeatures implements IFeatures {
  private readonly featureStateCache = new Map<string, Awaited<ReturnType<ILicensingReadRepository["getFeatureState"]>>>();

  constructor(private readonly repository: ILicensingReadRepository) {}

  clearRequestCache(): void {
    this.featureStateCache.clear();
  }

  async isEnabled(organizationId: OrganizationId, name: FeatureName): Promise<boolean> {
    const cacheKey = organizationId;
    let state = this.featureStateCache.get(cacheKey);
    if (state === undefined) {
      state = await this.repository.getFeatureState(organizationId);
      this.featureStateCache.set(cacheKey, state);
    }
    return evaluateFeature(state, name);
  }
}
