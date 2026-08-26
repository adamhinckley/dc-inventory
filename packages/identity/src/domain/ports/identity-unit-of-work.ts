import type { IOrganizationRepository } from "./organization-repository.js";
import type { IStaffUserRepository } from "./staff-user-repository.js";

export interface IIdentityUnitOfWork {
  readonly organizations: IOrganizationRepository;
  readonly staffUsers: IStaffUserRepository;
  run<T>(work: (uow: IIdentityUnitOfWork) => Promise<T>): Promise<T>;
}
