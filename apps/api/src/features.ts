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

export interface IFeatures {
  isEnabled(name: string): boolean;
}

export class InMemoryFeatures implements IFeatures {
  constructor(private readonly enabled: ReadonlySet<string>) {}

  isEnabled(name: string): boolean {
    return this.enabled.has(name);
  }
}

/** In-memory adapter with every core flag enabled. */
export function featuresAllCoreOn(): InMemoryFeatures {
  return new InMemoryFeatures(new Set(CORE_FEATURE_NAMES));
}
