import type { IIdentityUnitOfWork } from "../domain/ports/identity-unit-of-work.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import { InMemoryOrganizationRepository } from "./in-memory-organization-repository.js";
import { InMemoryStaffUserRepository } from "./in-memory-staff-user-repository.js";

export class InMemoryIdentityUnitOfWork implements IIdentityUnitOfWork {
  readonly organizations: IOrganizationRepository;
  readonly staffUsers: IStaffUserRepository;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    organizations?: IOrganizationRepository,
    staffUsers?: IStaffUserRepository,
  ) {
    this.organizations = organizations ?? new InMemoryOrganizationRepository();
    this.staffUsers = staffUsers ?? new InMemoryStaffUserRepository();
  }

  run<T>(work: (uow: IIdentityUnitOfWork) => Promise<T>): Promise<T> {
    const next = this.queue.then(() => work(this));
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
