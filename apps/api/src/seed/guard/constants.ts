/** Postgres schemas the Demo history generator owns and may reset. */
export const DEMO_OWNED_SCHEMAS = [
  "catalog",
  "purchasing",
  "inventory",
  "identity",
  "customers",
  "sales",
  "tax",
  "accounting",
] as const;

export type DemoOwnedSchema = (typeof DEMO_OWNED_SCHEMAS)[number];

/** Schemas that must survive a Demo reset. */
export const DEMO_EXCLUDED_SCHEMAS = ["licensing", "operator_bridge"] as const;

/** Hostnames accepted for `pnpm seed:demo` (local Compose + loopback only). */
export const LOCAL_DATABASE_HOSTS = [
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
] as const;
