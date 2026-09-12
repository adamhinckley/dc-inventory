import { OrganizationId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryOrganizationRepository } from "../src/adapters/in-memory-organization-repository.js";
import { ListOrganizationsUseCase } from "../src/application/list-organizations.js";

describe("ListOrganizations (in-memory)", () => {
  it("lists every organization with search and sort", async () => {
    const organizations = new InMemoryOrganizationRepository();
    await organizations.save({ id: OrganizationId.DEFAULT, slug: "acme", name: "Acme Wholesale" });
    await organizations.save({
      id: OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099"),
      slug: "beta",
      name: "Beta Wholesale",
    });

    const listOrganizations = new ListOrganizationsUseCase(organizations);
    const page = await listOrganizations.execute({
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.slug)).toEqual(["acme", "beta"]);

    const filtered = await listOrganizations.execute({
      q: "beta",
      page: 1,
      pageSize: 25,
      sortBy: "slug",
      sortOrder: "desc",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.name).toBe("Beta Wholesale");
  });
});
