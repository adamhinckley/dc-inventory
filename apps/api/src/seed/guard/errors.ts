export class DemoSeedGuardError extends Error {
  override readonly name = "DemoSeedGuardError";

  constructor(message: string) {
    super(message);
  }
}

export const OCCUPIED_DATABASE_MESSAGE =
  "Demo seed refuses to run: one or more demo-owned schemas already contain data. " +
  "Set DEMO_SEED_RESET=1 (exactly) to truncate Catalog, Purchasing, Inventory, Identity, Customers, Sales, Tax, and Accounting, then rerun. " +
  "Alternatively, remove the Postgres volume with `docker compose down -v`, run `pnpm db:migrate`, and seed again.";

export const INVALID_RESET_OPT_IN_MESSAGE =
  "Demo seed refuses to reset: DEMO_SEED_RESET must be exactly 1 (after trimming whitespace). " +
  "Values such as true, yes, or 01 are not accepted. " +
  "Alternatively, remove the Postgres volume with `docker compose down -v`, run `pnpm db:migrate`, and seed again.";
