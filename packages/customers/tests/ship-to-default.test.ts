import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryCustomerRepository } from "../src/adapters/in-memory-customer-repository.js";
import { InMemoryShipToRepository } from "../src/adapters/in-memory-ship-to-repository.js";
import { CreateCustomerUseCase } from "../src/application/create-customer.js";
import { CreateShipToUseCase } from "../src/application/create-ship-to.js";
import { ListShipTosUseCase } from "../src/application/list-ship-tos.js";
import { UpdateShipToUseCase } from "../src/application/update-ship-to.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const DEFAULT_ORG = OrganizationId.DEFAULT;

function harness() {
  const customers = new InMemoryCustomerRepository();
  const shipTos = new InMemoryShipToRepository();
  return {
    shipTos,
    createCustomer: new CreateCustomerUseCase(customers),
    createShipTo: new CreateShipToUseCase(customers, shipTos),
    listShipTos: new ListShipTosUseCase(customers, shipTos),
    updateShipTo: new UpdateShipToUseCase(customers, shipTos),
  };
}

async function createCustomer(h: ReturnType<typeof harness>) {
  const created = await h.createCustomer.execute({
    organizationId: DEFAULT_ORG,
    staffUserId: STAFF_ID,
    name: "Acme Wholesale",
    creditLimitCents: 1_000_000,
    currency: "USD",
    terms: "Net 30",
  });
  if (!created.ok) {
    throw new Error("expected customer");
  }
  return created.customer;
}

async function addShipTo(
  h: ReturnType<typeof harness>,
  customerId: ReturnType<typeof createCustomer> extends Promise<infer T> ? T["id"] : never,
  line1: string,
  isDefault?: boolean,
) {
  const created = await h.createShipTo.execute({
    organizationId: DEFAULT_ORG,
    staffUserId: STAFF_ID,
    customerId,
    line1,
    city: "Ogden",
    region: "UT",
    postal: "84401",
    country: "US",
    ...(isDefault === undefined ? {} : { isDefault }),
  });
  if (!created.ok) {
    throw new Error(`expected ship-to ${line1}`);
  }
  return created.shipTo;
}

describe("Ship-to default is exclusive", () => {
  it("clears the previous default when another ship-to is set as default", async () => {
    const h = harness();
    const customer = await createCustomer(h);
    const warehouse = await addShipTo(h, customer.id, "100 Warehouse Rd", true);
    const dock = await addShipTo(h, customer.id, "200 Loading Dock", false);

    const promoted = await h.updateShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: customer.id,
      shipToId: dock.id,
      isDefault: true,
    });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) {
      return;
    }
    expect(promoted.shipTo.isDefault).toBe(true);

    const listed = await h.shipTos.listByCustomer(customer.id);
    const defaults = listed.filter((row) => row.isDefault);
    expect(defaults.map((row) => row.id)).toEqual([dock.id]);
    expect(listed.find((row) => row.id === warehouse.id)?.isDefault).toBe(false);
  });

  it("creating a default ship-to unassigns the previous default", async () => {
    const h = harness();
    const customer = await createCustomer(h);
    const warehouse = await addShipTo(h, customer.id, "100 Warehouse Rd", true);
    const dock = await addShipTo(h, customer.id, "200 Loading Dock", true);

    const listed = await h.shipTos.listByCustomer(customer.id);
    const defaults = listed.filter((row) => row.isDefault);
    expect(defaults.map((row) => row.id)).toEqual([dock.id]);
    expect(listed.find((row) => row.id === warehouse.id)?.isDefault).toBe(false);
  });

  it("keeps list order when the default changes", async () => {
    const h = harness();
    const customer = await createCustomer(h);
    const main = await addShipTo(h, customer.id, "123 Main St", true);
    const warehouse = await addShipTo(h, customer.id, "100 Warehouse Rd", false);

    const before = await h.listShipTos.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: customer.id,
    });
    expect(before.ok).toBe(true);
    if (!before.ok) {
      return;
    }
    const orderBefore = before.items.map((row) => row.id);
    expect(orderBefore).toEqual([main.id, warehouse.id]);

    await h.updateShipTo.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: customer.id,
      shipToId: warehouse.id,
      isDefault: true,
    });

    const after = await h.listShipTos.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      customerId: customer.id,
    });
    expect(after.ok).toBe(true);
    if (!after.ok) {
      return;
    }
    expect(after.items.map((row) => row.id)).toEqual(orderBefore);
    expect(after.items.find((row) => row.id === warehouse.id)?.isDefault).toBe(true);
    expect(after.items.find((row) => row.id === main.id)?.isDefault).toBe(false);
  });
});
