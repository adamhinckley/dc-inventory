import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { DrizzleOrganizationRepository } from "./drizzle-organization-repository.js";
import { DrizzleStaffUserRepository } from "./drizzle-staff-user-repository.js";
import type { IIdentityUnitOfWork } from "../domain/ports/identity-unit-of-work.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import {
  loginThrottleCounters,
  opsUsers,
  organizations,
  platformUsers,
  sessions,
  staffUsers,
  wholesaleUsers,
} from "../persistence/schema.js";

export type IdentityTransactionDrizzle = PostgresJsDatabase<{
  organizations: typeof organizations;
  opsUsers: typeof opsUsers;
  platformUsers: typeof platformUsers;
  staffUsers: typeof staffUsers;
  wholesaleUsers: typeof wholesaleUsers;
  sessions: typeof sessions;
  loginThrottleCounters: typeof loginThrottleCounters;
}>;

/**
 * Postgres-backed identity unit of work for RegisterOrganization.
 * Serializes callers and runs each callback in one Drizzle transaction.
 */
export class DrizzleIdentityUnitOfWork implements IIdentityUnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: IdentityTransactionDrizzle) {}

  get organizations(): IOrganizationRepository {
    throw new Error("Access identity repositories inside identityUnitOfWork.run");
  }

  get staffUsers(): IStaffUserRepository {
    throw new Error("Access identity repositories inside identityUnitOfWork.run");
  }

  run<T>(work: (uow: IIdentityUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() =>
      this.db.transaction(async (tx) =>
        this.runOnTransaction(tx as IdentityTransactionDrizzle, work),
      ),
    );
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async runOnTransaction<T>(
    tx: IdentityTransactionDrizzle,
    work: (uow: IIdentityUnitOfWork) => Promise<T>,
  ): Promise<T> {
    const scope: IIdentityUnitOfWork = {
      organizations: new DrizzleOrganizationRepository(tx),
      staffUsers: new DrizzleStaffUserRepository(tx),
      run: (innerWork) => this.runOnTransaction(tx, innerWork),
    };
    return work(scope);
  }
}
