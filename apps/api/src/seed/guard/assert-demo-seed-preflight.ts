import { assertLocalDatabaseHost } from "./validate-database-host.js";
import { isDemoSeedResetOptIn } from "./parse-reset-opt-in.js";
import {
  DemoSeedGuardError,
  INVALID_RESET_OPT_IN_MESSAGE,
  OCCUPIED_DATABASE_MESSAGE,
} from "./errors.js";
import type { IDemoBookOccupancyPort, IDemoBookResetPort } from "./ports.js";

export type DemoSeedPreflightInput = {
  databaseUrl: string;
  resetOptIn: string | undefined;
  occupancy: IDemoBookOccupancyPort;
  reset: IDemoBookResetPort;
};

/**
 * Validate local host, refuse occupied databases unless reset is opted in,
 * and truncate demo-owned schemas before any seed writes begin.
 */
export async function assertDemoSeedPreflight(
  input: DemoSeedPreflightInput,
): Promise<void> {
  assertLocalDatabaseHost(input.databaseUrl);

  const occupancy = await input.occupancy.checkOccupancy();
  if (!occupancy.occupied) {
    return;
  }

  if (!isDemoSeedResetOptIn(input.resetOptIn)) {
    throw new DemoSeedGuardError(
      input.resetOptIn === undefined || input.resetOptIn.trim().length === 0
        ? OCCUPIED_DATABASE_MESSAGE
        : INVALID_RESET_OPT_IN_MESSAGE,
    );
  }

  await input.reset.resetDemoOwnedSchemas();

  const afterReset = await input.occupancy.checkOccupancy();
  if (afterReset.occupied) {
    const location = afterReset.location ?? "an unknown demo-owned table";
    throw new DemoSeedGuardError(
      `Demo seed reset did not clear ${location}. Refusing to continue with a partially occupied database.`,
    );
  }
}
