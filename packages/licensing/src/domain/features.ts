export const FEATURE_NAMES = [
  "catalog",
  "inventory",
  "purchasing",
  "sales",
  "customers",
  "ar",
] as const;

export const CORE_FEATURE_NAMES = FEATURE_NAMES;

export type FeatureName = (typeof FEATURE_NAMES)[number];
export type FlagOverrideDirection = "force_on" | "force_off";

export interface TenantFlagOverride {
  featureName: string;
  direction: FlagOverrideDirection;
}

export interface TenantFeatureState {
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | null;
  flagOverrides: readonly TenantFlagOverride[];
}

export function evaluateFeature(state: TenantFeatureState, name: FeatureName): boolean {
  const overrides = state.flagOverrides.filter((override) => override.featureName === name);
  if (overrides.some((override) => override.direction === "force_off")) {
    return false;
  }
  if (overrides.some((override) => override.direction === "force_on")) {
    return true;
  }
  return state.subscriptionStatus === "trialing" || state.subscriptionStatus === "active";
}
