import {
  CustomerId,
  OrganizationId,
  PurchaseOrderId,
  Sku,
  StaffUserId,
  SupplierId,
} from "@dc-inventory/shared-kernel";
import { describe, expect, it } from "vitest";
import { InMemoryPurchaseOrderRepository } from "../src/adapters/in-memory-purchase-order-repository.js";
import { newUuid, PurchaseOrderLineId } from "../src/domain/ids.js";
import type {
  CommittedCustomerName,
  ICommittedCustomerNamesPort,
  IInventoryUncoveredReadPort,
} from "../src/domain/ports/short-readout.js";
import { GetPurchaseOrderShortReadoutUseCase } from "../src/application/get-purchase-order-short-readout.js";

const DEFAULT_ORG = OrganizationId.DEFAULT;
const STAFF_ID = StaffUserId.parse("11111111-1111-4111-8111-111111111111");
const SKU_A = Sku.parse("SHORT-A");
const SKU_B = Sku.parse("SHORT-B");
const CUSTOMER_ID = CustomerId.parse("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
const SUPPLIER_ID = SupplierId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
const PO_ID = PurchaseOrderId.parse("cccccccc-cccc-4ccc-8ccc-cccccccccccc");

class StubUncoveredPort implements IInventoryUncoveredReadPort {
  private readonly values = new Map<string, number>();

  set(sku: string, uncovered: number): void {
    this.values.set(sku, uncovered);
  }

  async getUncovered(_organizationId: OrganizationId, sku: Sku): Promise<number> {
    return this.values.get(sku.value) ?? 0;
  }

  async getUncoveredBySkus(
    _organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<ReadonlyMap<string, number>> {
    const rows = new Map<string, number>();
    for (const sku of skus) {
      rows.set(sku.value, this.values.get(sku.value) ?? 0);
    }
    return rows;
  }
}

class StubCommittedCustomersPort implements ICommittedCustomerNamesPort {
  readonly requestedSkus: Sku[] = [];
  private customers: readonly CommittedCustomerName[] = [];

  setCustomers(customers: readonly CommittedCustomerName[]): void {
    this.customers = customers;
  }

  async listCommittedCustomerNames(
    _organizationId: OrganizationId,
    skus: readonly Sku[],
  ): Promise<readonly CommittedCustomerName[]> {
    this.requestedSkus.splice(0, this.requestedSkus.length, ...skus);
    return this.customers;
  }
}

async function seedPurchaseOrder(repo: InMemoryPurchaseOrderRepository) {
  await repo.save({
    id: PO_ID,
    organizationId: DEFAULT_ORG,
    supplierId: SUPPLIER_ID,
    documentNumber: "PO-HF-00001",
    status: "confirmed",
    shipDate: null,
    cancelDate: null,
    createdAt: new Date("2026-09-02T00:00:00.000Z"),
    lines: [
      {
        id: PurchaseOrderLineId.parse(newUuid()),
        sku: SKU_A,
        name: "SKU A",
        qty: 10,
        receivedQty: 0,
      },
      {
        id: PurchaseOrderLineId.parse(newUuid()),
        sku: SKU_B,
        name: "SKU B",
        qty: 5,
        receivedQty: 0,
      },
    ],
  });
}

describe("GetPurchaseOrderShortReadoutUseCase", () => {
  it("returns one uncovered row per PO SKU and customers only for SKUs with uncovered > 0", async () => {
    const purchaseOrders = new InMemoryPurchaseOrderRepository(
      async () => "",
      async () => "HF",
    );
    await seedPurchaseOrder(purchaseOrders);
    const inventoryUncovered = new StubUncoveredPort();
    inventoryUncovered.set(SKU_A.value, 10);
    inventoryUncovered.set(SKU_B.value, 0);
    const committedCustomers = new StubCommittedCustomersPort();
    committedCustomers.setCustomers([{ customerId: CUSTOMER_ID, name: "Acme Wholesale" }]);

    const useCase = new GetPurchaseOrderShortReadoutUseCase(
      purchaseOrders,
      inventoryUncovered,
      committedCustomers,
    );
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: PO_ID,
    });

    expect(result).toEqual({
      ok: true,
      uncovered: [
        { sku: SKU_A.value, uncovered: 10 },
        { sku: SKU_B.value, uncovered: 0 },
      ],
      affectedCustomers: [{ customerId: CUSTOMER_ID, name: "Acme Wholesale" }],
    });
    expect(committedCustomers.requestedSkus.map((sku) => sku.value)).toEqual([SKU_A.value]);
  });

  it("returns empty affectedCustomers when every uncovered is zero", async () => {
    const purchaseOrders = new InMemoryPurchaseOrderRepository(
      async () => "",
      async () => "HF",
    );
    await seedPurchaseOrder(purchaseOrders);
    const inventoryUncovered = new StubUncoveredPort();
    inventoryUncovered.set(SKU_A.value, 0);
    inventoryUncovered.set(SKU_B.value, 0);
    const committedCustomers = new StubCommittedCustomersPort();
    committedCustomers.setCustomers([{ customerId: CUSTOMER_ID, name: "Acme Wholesale" }]);

    const useCase = new GetPurchaseOrderShortReadoutUseCase(
      purchaseOrders,
      inventoryUncovered,
      committedCustomers,
    );
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: PO_ID,
    });

    expect(result).toEqual({
      ok: true,
      uncovered: [
        { sku: SKU_A.value, uncovered: 0 },
        { sku: SKU_B.value, uncovered: 0 },
      ],
      affectedCustomers: [],
    });
    expect(committedCustomers.requestedSkus).toEqual([]);
  });

  it("returns not_found when the purchase order is missing", async () => {
    const useCase = new GetPurchaseOrderShortReadoutUseCase(
      new InMemoryPurchaseOrderRepository(),
      new StubUncoveredPort(),
      new StubCommittedCustomersPort(),
    );
    const result = await useCase.execute({
      organizationId: DEFAULT_ORG,
      staffUserId: STAFF_ID,
      purchaseOrderId: PO_ID,
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
