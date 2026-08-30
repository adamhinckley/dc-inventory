/**
 * Licensing evaluation stays wired (`LicensingFeatures` + Postgres) but is
 * inactive unless `FEATURES_ALL_CORE_ON=0`. `1` / `0` after trim are explicit.
 * Unset means every core flag is on, except Vitest (`NODE_ENV=test`).
 */
export function readFeaturesAllCoreOn(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.FEATURES_ALL_CORE_ON?.trim();
  if (raw === "1") {
    return true;
  }
  if (raw === "0") {
    return false;
  }
  return env.NODE_ENV !== "test";
}
