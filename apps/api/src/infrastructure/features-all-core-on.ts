/**
 * Local listen should not need a `licensing.subscriptions` row.
 * `1` / `0` after trim are explicit. Unset means on except `test` and `production`.
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
  return env.NODE_ENV !== "test" && env.NODE_ENV !== "production";
}
