import type { IIdentityUnitOfWork } from "../domain/ports/identity-unit-of-work.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import {
  InMemoryOrganizationRepository,
  type InMemoryOrganizationSnapshot,
} from "./in-memory-organization-repository.js";
import {
  InMemoryStaffUserRepository,
  type InMemoryStaffUserSnapshot,
} from "./in-memory-staff-user-repository.js";

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
    const organizationSnapshot = this.snapshotOrganizations();
    const staffSnapshot = this.snapshotStaffUsers();
    const next = this.queue.then(async () => {
      try {
        return await work(this);
      } catch (error) {
        this.restoreOrganizations(organizationSnapshot);
        this.restoreStaffUsers(staffSnapshot);
        throw error;
      }
    });
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private snapshotOrganizations(): InMemoryOrganizationSnapshot | undefined {
    if (!(this.organizations instanceof InMemoryOrganizationRepository)) {
      return undefined;
    }
    return this.organizations.createSnapshot();
  }

  private snapshotStaffUsers(): InMemoryStaffUserSnapshot | undefined {
    if (!(this.staffUsers instanceof InMemoryStaffUserRepository)) {
      return undefined;
    }
    return this.staffUsers.createSnapshot();
  }

  private restoreOrganizations(snapshot: InMemoryOrganizationSnapshot | undefined): void {
    if (
      snapshot === undefined ||
      !(this.organizations instanceof InMemoryOrganizationRepository)
    ) {
      return;
    }
    this.organizations.restoreSnapshot(snapshot);
  }

  private restoreStaffUsers(snapshot: InMemoryStaffUserSnapshot | undefined): void {
    if (snapshot === undefined || !(this.staffUsers instanceof InMemoryStaffUserRepository)) {
      return;
    }
    this.staffUsers.restoreSnapshot(snapshot);
  }
}
