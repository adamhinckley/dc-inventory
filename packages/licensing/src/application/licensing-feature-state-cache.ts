import { AsyncLocalStorage } from "node:async_hooks";
import type { TenantFeatureState } from "../domain/features.js";

type FeatureStateCache = Map<string, TenantFeatureState>;

const featureStateCacheStorage = new AsyncLocalStorage<FeatureStateCache>();

export function runWithLicensingFeatureStateCache<T>(work: () => T): T {
  return featureStateCacheStorage.run(new Map(), work);
}

export async function runWithLicensingFeatureStateCacheAsync<T>(
  work: () => Promise<T>,
): Promise<T> {
  return featureStateCacheStorage.run(new Map(), work);
}

export function getLicensingFeatureStateCache(): FeatureStateCache | undefined {
  return featureStateCacheStorage.getStore();
}
