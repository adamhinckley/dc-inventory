import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCustomerRepository } from "../src/adapters/in-memory-customer-repository.js";
import { CreateCustomerUseCase } from "../src/application/create-customer.js";
import { ListCustomersUseCase } from "../src/application/list-customers.js";
import { UpdateCustomerUseCase } from "../src/application/update-customer.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const DEFAULT_ORG = OrganizationId.DEFAULT;

function harness() {
  const customers = new InMemoryCustomerRepository();
  return {
    customers,
    createCustomer: new CreateCustomerUseCase(customers),
    updateCustomer: new UpdateCustomerUseCase(customers),
    listCustomers: new ListCustomersUseCase(customers),
  };
}

async function createNamed(
  h: ReturnType<typeof harness>,
  name: string,
  accountStatus?: "active" | "on_hold" | "inactive",
) {
  const created = await h.createCustomer.execute({
    organizationId: DEFAULT_ORG,
    staffUserId: STAFF_ID,
    name,
    creditLimitCents: 100_000,
    terms: "Net 30",
  });
  if (!created.ok) {
    throw new Error("expected create");
  }
  if (accountStatus !== undefined && accountStatus !== "active") {
    const updated = await h.updateCustomer.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: created.customer.id,
      accountStatus,
    });
    if (!updated.ok) {
      throw new Error("expected update");
    }
    return updated.customer;
  }
  return created.customer;
}

describe("ListCustomers accountStatus filter", () => {
  it("returns all customers when accountStatus is omitted", async () => {
    const h = harness();
    await createNamed(h, "Active Co", "active");
    await createNamed(h, "Hold Co", "on_hold");
    await createNamed(h, "Inactive Co", "inactive");

    const listed = await h.listCustomers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(3);
    expect(listed.items.map((row) => row.name)).toEqual([
      "Active Co",
      "Hold Co",
      "Inactive Co",
    ]);
  });

  it("filters by accountStatus", async () => {
    const h = harness();
    await createNamed(h, "Active Co", "active");
    await createNamed(h, "Hold Co", "on_hold");
    await createNamed(h, "Inactive Co", "inactive");

    const onHold = await h.listCustomers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      accountStatus: "on_hold",
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(onHold.total).toBe(1);
    expect(onHold.items[0]?.name).toBe("Hold Co");
    expect(onHold.items[0]?.accountStatus).toBe("on_hold");
  });

  it("combines accountStatus with search", async () => {
    const h = harness();
    await createNamed(h, "Alpha Active", "active");
    await createNamed(h, "Alpha Hold", "on_hold");

    const listed = await h.listCustomers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      q: "alpha",
      accountStatus: "on_hold",
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(listed.total).toBe(1);
    expect(listed.items[0]?.name).toBe("Alpha Hold");
  });
});
