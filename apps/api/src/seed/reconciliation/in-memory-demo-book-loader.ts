import type { IInvoiceRepository } from "@dc-inventory/accounting";
import type { InMemoryInvoiceRepository } from "@dc-inventory/accounting";
import type { IProductRepository } from "@dc-inventory/catalog";
import type {
  ICustomerRepository,
  IExemptionCertificateRepository,
  IShipToRepository,
} from "@dc-inventory/customers";
import type { IStaffUserRepository, IWholesaleUserRepository } from "@dc-inventory/identity";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import type { IInventoryReadModel } from "@dc-inventory/inventory";
import type { IPurchaseOrderRepository, Supplier } from "@dc-inventory/purchasing";
import type { ISalesOrderRepository } from "@dc-inventory/sales";
import type {
  IProductImageSeedRepository,
  IReorderPolicySeedRepository,
  ISupplierProductSeedRepository,
} from "../ports/static-seed-types.js";
import { assembleDemoBook } from "./demo-book-assembler.js";
import type { DemoBook, IDemoBookReader } from "./demo-book.js";

export type InMemoryDemoBookLoadPorts = {
  defaultLocationId: string;
  staffEmail: string;
  wholesaleEmail: string;
  products: Pick<IProductRepository, "listMatching">;
  productImages: IProductImageSeedRepository;
  suppliers: {
    listAll(): Promise<readonly Supplier[]>;
  };
  supplierProducts: ISupplierProductSeedRepository;
  customers: Pick<ICustomerRepository, "list">;
  shipTos: Pick<IShipToRepository, "listByCustomer">;
  exemptionCertificates: Pick<IExemptionCertificateRepository, "listByCustomer">;
  staffUsers: Pick<IStaffUserRepository, "findByEmail">;
  wholesaleUsers: Pick<IWholesaleUserRepository, "findByEmail">;
  purchaseOrders: Pick<IPurchaseOrderRepository, "list">;
  salesOrders: Pick<ISalesOrderRepository, "list">;
  invoices: Pick<IInvoiceRepository, "findByOrderId" | "listApplications"> & {
    snapshot(): ReturnType<InMemoryInvoiceRepository["snapshot"]>;
  };
  readModel: Pick<IInventoryReadModel, "listMovements"> & {
    cloneSnapshots(): ReturnType<
      import("@dc-inventory/inventory").InMemoryInventoryReadModel["cloneSnapshots"]
    >;
  };
  reorderPolicies: IReorderPolicySeedRepository;
};

export class InMemoryDemoBookLoader implements IDemoBookReader {
  constructor(private readonly ports: InMemoryDemoBookLoadPorts) {}

  async load(): Promise<DemoBook> {
    const products = await this.ports.products.listMatching({
      organizationId: OrganizationId.DEFAULT,
    });
    const skuByProductId = new Map(
      products.map((row) => [String(row.product.id), row.product.sku.value]),
    );
    const images = await this.ports.productImages.listAll();
    const suppliers = await this.ports.suppliers.listAll();
    const supplierProducts = await this.ports.supplierProducts.listAll();
    const customerPage = await this.ports.customers.list({
      organizationId: OrganizationId.DEFAULT,
      page: 1,
      pageSize: 10_000,
      sortBy: "createdAt",
      sortOrder: "asc",
    });
    const customers = customerPage.items;

    const shipTos = [];
    const exemptionCertificates = [];
    for (const customer of customers) {
      const customerShipTos = await this.ports.shipTos.listByCustomer(customer.id);
      shipTos.push(
        ...customerShipTos.map((row) => ({
          id: row.id,
          customerId: row.customerId,
          line1: row.line1,
          line2: row.line2,
          city: row.city,
          region: row.region,
          postal: row.postal,
          country: row.country,
          isDefault: row.isDefault,
        })),
      );
      const certificates = await this.ports.exemptionCertificates.listByCustomer(customer.id);
      exemptionCertificates.push(
        ...certificates.map((row) => ({
          customerId: row.customerId,
          objectKey: row.objectKey,
          jurisdiction: row.jurisdiction,
          entityUseCode: row.entityUseCode,
          expiresAt: row.expiresAt,
          status: row.status,
        })),
      );
    }

    const staff = await this.ports.staffUsers.findByEmail(OrganizationId.DEFAULT, this.ports.staffEmail);
    const wholesale = await this.ports.wholesaleUsers.findByEmail(
      OrganizationId.DEFAULT,
      this.ports.wholesaleEmail,
    );
    if (staff === null || wholesale === null) {
      throw new Error("demo identity rows are missing");
    }

    const purchaseOrderPage = await this.ports.purchaseOrders.list({
      page: 1,
      pageSize: 20_000,
    });
    const salesOrderPage = await this.ports.salesOrders.list({
      page: 1,
      pageSize: 20_000,
    });

    const invoices = [];
    const paymentApplications = [];
    const payments = [];
    const paymentById = new Map<string, { id: string; customerId: string; amountCents: number }>();

    for (const order of salesOrderPage.items) {
      const invoice = await this.ports.invoices.findByOrderId(order.id);
      if (invoice === null) {
        continue;
      }
      invoices.push({
        id: invoice.id,
        orderId: invoice.orderId,
        customerId: invoice.customerId,
        documentNumber: invoice.documentNumber,
        postedAt: invoice.postedAt,
        subtotalCents: invoice.subtotal.amountMinor,
        taxTotalCents: invoice.taxTotal.amountMinor,
        totalCents: invoice.total.amountMinor,
      });
      const applications = await this.ports.invoices.listApplications(invoice.id);
      for (const application of applications) {
        paymentApplications.push({
          paymentId: application.paymentId,
          invoiceId: application.invoiceId,
          amountCents: application.amount.amountMinor,
        });
        const record = [...this.ports.invoices.snapshot().paymentsByKey.values()].find(
          (row) => row.payment.id === application.paymentId,
        );
        if (record !== undefined) {
          paymentById.set(record.payment.id, {
            id: record.payment.id,
            customerId: record.payment.customerId,
            amountCents: record.payment.amount.amountMinor,
          });
        }
      }
    }
    payments.push(...paymentById.values());

    const movements = (await this.ports.readModel.listMovements()).map((row) => ({
      sku: row.sku.value,
      locationId: row.locationId,
      movementType: row.movementType,
      quantity: row.quantity,
      createdAt: row.createdAt,
    }));

    const snapshots = [];
    for (const [key, figures] of this.ports.readModel.cloneSnapshots().entries()) {
      const parts = key.split(":");
      const sku = parts[1] ?? "";
      const locationId = parts[2] ?? this.ports.defaultLocationId;
      snapshots.push({
        sku,
        locationId,
        onHand: figures.onHand,
        onOrder: figures.onOrder,
        allocated: figures.allocated,
      });
    }

    const reorderPolicies = await this.ports.reorderPolicies.listAll();

    return assembleDemoBook({
      defaultLocationId: this.ports.defaultLocationId,
      products: products.map((row) => ({
        id: row.product.id,
        sku: row.product.sku.value,
        name: row.product.name,
        description: row.product.description,
        uom: row.product.uom,
        memberPriceCents: row.product.memberPrice.amountMinor,
        listPriceCents: null,
        currency: row.product.memberPrice.currency,
        webWholesale: row.product.webWholesale,
        taxCategoryCode: row.product.taxCategoryCode,
      })),
      images: images.map((row) => ({
        productId: row.productId,
        sku: skuByProductId.get(row.productId) ?? "",
        objectKey: row.objectKey,
        contentType: row.contentType,
      })),
      suppliers: suppliers.map((row) => ({
        id: row.id,
        vendorNumber: row.vendorNumber,
        name: row.name,
      })),
      supplierProducts: supplierProducts.map((row) => ({
        supplierId: row.supplierId,
        sku: row.sku,
        minOrderQty: row.minOrderQty,
      })),
      customers: customers.map((row) => ({
        id: row.id,
        name: row.name,
        creditLimitCents: row.creditLimit.amountMinor,
        currency: row.creditLimit.currency,
        terms: row.terms,
      })),
      shipTos,
      contacts: [],
      exemptionCertificates,
      staffUsers: [{ id: staff.id, email: staff.email }],
      wholesaleUsers: [
        { id: wholesale.id, email: wholesale.email, customerId: wholesale.customerId },
      ],
      opsUsers: [],
      purchaseOrders: purchaseOrderPage.items.map((row) => ({
        id: row.id,
        supplierId: row.supplierId,
        status: row.status,
        documentNumber: row.documentNumber,
        createdAt: row.createdAt,
      })),
      purchaseOrderLines: purchaseOrderPage.items.flatMap((row) =>
        row.lines.map((line) => ({
          purchaseOrderId: row.id,
          sku: line.sku.value,
          qty: line.qty,
          receivedQty: line.receivedQty,
        })),
      ),
      salesOrders: salesOrderPage.items.map((row) => ({
        id: row.id,
        customerId: row.customerId,
        status: row.status,
        documentNumber: row.documentNumber,
        createdAt: row.createdAt,
        shipLine1: row.shipLine1 ?? null,
        shipLine2: row.shipLine2 ?? null,
        shipCity: row.shipCity ?? null,
        shipRegion: row.shipRegion ?? null,
        shipPostal: row.shipPostal ?? null,
        shipCountry: row.shipCountry ?? null,
      })),
      salesOrderLines: salesOrderPage.items.flatMap((row) =>
        row.lines.map((line) => ({
          orderId: row.id,
          sku: line.sku.value,
          qty: line.qty,
          unitPriceCents: line.unitPrice.amountMinor,
        })),
      ),
      invoices,
      invoiceTaxLines: [],
      payments,
      paymentApplications,
      taxCommits: [],
      movements,
      snapshots,
      reorderPolicies: reorderPolicies.map((row) => ({
        sku: row.sku,
        locationId: row.locationId,
        minOnHand: row.minOnHand,
        maxOnHand: row.maxOnHand,
      })),
    });
  }
}
