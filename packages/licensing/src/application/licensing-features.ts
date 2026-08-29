import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { evaluateFeature, type FeatureName } from "../domain/features.js";
import type { IFeatures } from "../domain/ports/features.js";
import type { ILicensingReadRepository } from "../domain/ports/licensing-read-repository.js";

export class LicensingFeatures implements IFeatures {
  constructor(private readonly repository: ILicensingReadRepository) {}

  async isEnabled(organizationId: OrganizationId, name: FeatureName): Promise<boolean> {
    return evaluateFeature(await this.repository.getFeatureState(organizationId), name);
  }
}
