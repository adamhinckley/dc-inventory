import { OrganizationId, StaffUserId, SupplierId } from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemorySupplierRepository } from "../src/adapters/in-memory-supplier-repository.js";
import { CreateSupplierUseCase } from "../src/application/create-supplier.js";
import { GetSupplierUseCase } from "../src/application/get-supplier.js";
import { ListSuppliersUseCase } from "../src/application/list-suppliers.js";
import { UpdateSupplierUseCase } from "../src/application/update-supplier.js";

const STAFF_ID = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440010");
const OTHER_STAFF = StaffUserId.parse("550e8400-e29b-41d4-a716-446655440011");
const DEFAULT_ORG = OrganizationId.DEFAULT;
const BETA_ORG = OrganizationId.parse("660e8400-e29b-41d4-a716-446655440099");

function harness() {
  const suppliers = new InMemorySupplierRepository();
  return {
    suppliers,
    createSupplier: new CreateSupplierUseCase(suppliers),
    getSupplier: new GetSupplierUseCase(suppliers),
    listSuppliers: new ListSuppliersUseCase(suppliers),
    updateSupplier: new UpdateSupplierUseCase(suppliers),
  };
}

describe("Suppliers use cases (in-memory)", () => {
  it("creates, lists, gets, and updates suppliers", async () => {
    const h = harness();
    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme Supply",
      vendorNumber: "VEND-001",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const second = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Beta Parts",
      vendorNumber: "VEND-002",
    });
    expect(second.ok).toBe(true);

    const listed = await h.listSuppliers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: OTHER_STAFF,
      page: 1,
      pageSize: 25,
      sortBy: "vendorNumber",
      sortOrder: "asc",
    });
    expect(listed.total).toBe(2);
    expect(listed.items.map((row) => row.vendorNumber)).toEqual(["VEND-001", "VEND-002"]);

    const got = await h.getSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
    });
    expect(got).toEqual({ ok: true, supplier: created.supplier });

    const updated = await h.updateSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      name: "Acme Supply Co",
    });
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.supplier.name).toBe("Acme Supply Co");
      expect(updated.supplier.vendorNumber).toBe("VEND-001");
    }
  });

  it("searches suppliers by vendor number or name", async () => {
    const h = harness();
    await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Widget Warehouse",
      vendorNumber: "WW-100",
    });
    await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Gadget Depot",
      vendorNumber: "GD-200",
    });

    const byVendor = await h.listSuppliers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      q: "ww-1",
      page: 1,
      pageSize: 25,
      sortBy: "vendorNumber",
      sortOrder: "asc",
    });
    expect(byVendor.total).toBe(1);
    expect(byVendor.items[0]?.name).toBe("Widget Warehouse");

    const byName = await h.listSuppliers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      q: "depot",
      page: 1,
      pageSize: 25,
      sortBy: "vendorNumber",
      sortOrder: "asc",
    });
    expect(byName.total).toBe(1);
    expect(byName.items[0]?.vendorNumber).toBe("GD-200");

    const sorted = await h.listSuppliers.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      page: 1,
      pageSize: 25,
      sortBy: "name",
      sortOrder: "desc",
    });
    expect(sorted.items.map((row) => row.name)).toEqual([
      "Widget Warehouse",
      "Gadget Depot",
    ]);
  });

  it("rejects duplicate vendor numbers within an org", async () => {
    const h = harness();
    const first = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "First Vendor",
      vendorNumber: "V-1",
    });
    expect(first.ok).toBe(true);

    const duplicate = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Other Vendor",
      vendorNumber: "V-1",
    });
    expect(duplicate).toEqual({ ok: false, reason: "duplicate_vendor_number" });
  });

  it("allows the same vendor number in different orgs", async () => {
    const h = harness();
    const defaultOrg = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Shared Name",
      vendorNumber: "V-1",
    });
    const betaOrg = await h.createSupplier.execute({
      organizationId: BETA_ORG,
      staffUserId: STAFF_ID,
      name: "Shared Name",
      vendorNumber: "V-1",
    });
    expect(defaultOrg.ok).toBe(true);
    expect(betaOrg.ok).toBe(true);
  });

  it("rejects invalid create/update payloads and missing suppliers", async () => {
    const h = harness();
    expect(
      await h.createSupplier.execute({
        organizationId: DEFAULT_ORG,
        staffUserId: STAFF_ID,
        name: "  ",
        vendorNumber: "V-1",
      }),
    ).toEqual({ ok: false, reason: "invalid" });

    const missing = await h.getSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    });
    expect(missing).toEqual({ ok: false, reason: "not_found" });

    const created = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Acme",
      vendorNumber: "V-1",
    });
    if (!created.ok) {
      throw new Error("expected create");
    }

    const duplicateUpdate = await h.updateSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: created.supplier.id,
      vendorNumber: "V-1",
    });
    expect(duplicateUpdate.ok).toBe(true);

    const other = await h.createSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      name: "Other",
      vendorNumber: "V-2",
    });
    if (!other.ok) {
      throw new Error("expected create");
    }

    const conflict = await h.updateSupplier.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      supplierId: other.supplier.id,
      vendorNumber: "V-1",
    });
    expect(conflict).toEqual({ ok: false, reason: "duplicate_vendor_number" });
  });
});
