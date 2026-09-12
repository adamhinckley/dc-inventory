import type {
  IOrganizationRepository,
  ListOrganizationsQuery,
  OrganizationListPage,
} from "../domain/ports/organization-repository.js";

export class ListOrganizationsUseCase {
  constructor(private readonly organizations: IOrganizationRepository) {}

  async execute(query: ListOrganizationsQuery): Promise<OrganizationListPage> {
    return this.organizations.list(query);
  }
}
