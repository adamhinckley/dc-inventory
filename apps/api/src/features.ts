import type { OrganizationId } from "@dc-inventory/shared-kernel";

/** Core v1 product flags — all on in the composition-root stub (ADA-35). */
export const CORE_FEATURE_NAMES = [
  "catalog",
  "inventory",
  "purchasing",
  "sales",
  "customers",
  "ar",
] as const;

export type CoreFeatureName = (typeof CORE_FEATURE_NAMES)[number];

export type FlagOverrideDirection = "force_on" | "force_off";

export interface TenantFlagOverride {
  featureName: string;
  direction: FlagOverrideDirection;
}

export interface TenantLicensingState {
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled";
  flagOverrides: readonly TenantFlagOverride[];
}

export interface IFeatures {
  isEnabled(organizationId: OrganizationId, name: string): boolean;
}

function isCoreFeatureName(name: string): name is CoreFeatureName {
  return (CORE_FEATURE_NAMES as readonly string[]).includes(name);
}

function subscriptionGrantsCore(
  status: TenantLicensingState["subscriptionStatus"],
): boolean {
  return status === "trialing" || status === "active";
}

export class InMemoryFeatures implements IFeatures {
  constructor(
    private readonly tenantStates: ReadonlyMap<
      OrganizationId,
      TenantLicensingState
    > = new Map(),
    private readonly defaultCoreOn: ReadonlySet<string> = new Set(
      CORE_FEATURE_NAMES,
    ),
  ) {}

  isEnabled(organizationId: OrganizationId, name: string): boolean {
    const state = this.tenantStates.get(organizationId);
    if (!state) {
      if (this.tenantStates.size > 0) {
        return false;
      }
      return this.defaultCoreOn.has(name);
    }

    const overrides = state.flagOverrides.filter(
      (override) => override.featureName === name,
    );
    if (overrides.some((override) => override.direction === "force_off")) {
      return false;
    }
    if (overrides.some((override) => override.direction === "force_on")) {
      return true;
    }

    if (isCoreFeatureName(name)) {
      return subscriptionGrantsCore(state.subscriptionStatus);
    }

    return false;
  }
}

/** In-memory adapter with every core flag enabled for every tenant. */
export function featuresAllCoreOn(): InMemoryFeatures {
  return new InMemoryFeatures(new Map(), new Set(CORE_FEATURE_NAMES));
}
