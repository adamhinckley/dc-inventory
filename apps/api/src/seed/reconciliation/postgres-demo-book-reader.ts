import { and, eq } from "drizzle-orm";
import {
  invoiceTaxLines,
  invoices,
  paymentApplications,
  payments,
} from "@dc-inventory/accounting/schema";
import { productImages, products } from "@dc-inventory/catalog/schema";
import {
  contacts,
  customers,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
import { opsUsers, staffUsers, wholesaleUsers } from "@dc-inventory/identity/schema";
import { PHASE2_DEFAULT_LOCATION_CODE } from "@dc-inventory/inventory";
import {
  locations,
  reorderPolicies,
  stockMovements,
  stockSnapshots,
} from "@dc-inventory/inventory/schema";
import {
  purchaseOrderLines,
  purchaseOrders,
  supplierProducts,
  suppliers,
} from "@dc-inventory/purchasing/schema";
import { orderLines, orders } from "@dc-inventory/sales/schema";
import type { AppDrizzle } from "../../infrastructure/db.js";
import { DEMO_SEED_ORGANIZATION_ID } from "../demo-seed-organization.js";
import { taxCommits } from "../../infrastructure/schema/tax.js";
import { assembleDemoBook } from "./demo-book-assembler.js";
import type { DemoBook, IDemoBookReader } from "./demo-book.js";

/**
 * Postgres read adapter for Demo reconciliation. Loads the same facts the seed
 * writes so {@link assertDemoBook} and later report queries share one contract.
 */
export class PostgresDemoBookReader implements IDemoBookReader {
  constructor(private readonly db: AppDrizzle) {}

  async load(): Promise<DemoBook> {
    const defaultLocation = await this.db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, DEMO_SEED_ORGANIZATION_ID),
          eq(locations.code, PHASE2_DEFAULT_LOCATION_CODE),
        ),
      )
      .limit(1);

    const defaultLocationId = defaultLocation[0]?.id;
    if (!defaultLocationId) {
      throw new Error(`missing DEFAULT inventory location (${PHASE2_DEFAULT_LOCATION_CODE})`);
    }

    const [
      productRows,
      imageRows,
      supplierRows,
      supplierProductRows,
      customerRows,
      shipToRows,
      contactRows,
      exemptionRows,
      staffRows,
      wholesaleRows,
      opsRows,
      purchaseOrderRows,
      purchaseOrderLineRows,
      salesOrderRows,
      salesOrderLineRows,
      invoiceRows,
      invoiceTaxLineRows,
      paymentRows,
      paymentApplicationRows,
      taxCommitRows,
      movementRows,
      snapshotRows,
      reorderPolicyRows,
    ] = await Promise.all([
      this.db
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          description: products.description,
          uom: products.uom,
          memberPriceCents: products.memberPriceCents,
          listPriceCents: products.listPriceCents,
          currency: products.currency,
          webWholesale: products.webWholesale,
          taxCategoryCode: products.taxCategoryCode,
        })
        .from(products)
        .where(eq(products.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          productId: productImages.productId,
          sku: products.sku,
          objectKey: productImages.objectKey,
          contentType: productImages.contentType,
        })
        .from(productImages)
        .innerJoin(products, eq(productImages.productId, products.id))
        .where(eq(products.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: suppliers.id,
          vendorNumber: suppliers.vendorNumber,
          name: suppliers.name,
        })
        .from(suppliers)
        .where(eq(suppliers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          supplierId: supplierProducts.supplierId,
          sku: supplierProducts.sku,
          minOrderQty: supplierProducts.minOrderQty,
        })
        .from(supplierProducts)
        .innerJoin(suppliers, eq(supplierProducts.supplierId, suppliers.id))
        .where(eq(suppliers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: customers.id,
          name: customers.name,
          creditLimitCents: customers.creditLimitCents,
          currency: customers.currency,
          terms: customers.terms,
        })
        .from(customers)
        .where(eq(customers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: shipTos.id,
          customerId: shipTos.customerId,
          line1: shipTos.line1,
          line2: shipTos.line2,
          city: shipTos.city,
          region: shipTos.region,
          postal: shipTos.postal,
          country: shipTos.country,
          isDefault: shipTos.isDefault,
        })
        .from(shipTos)
        .innerJoin(customers, eq(shipTos.customerId, customers.id))
        .where(eq(customers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          customerId: contacts.customerId,
          name: contacts.name,
          email: contacts.email,
        })
        .from(contacts)
        .innerJoin(customers, eq(contacts.customerId, customers.id))
        .where(eq(customers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          customerId: exemptionCertificates.customerId,
          objectKey: exemptionCertificates.objectKey,
          jurisdiction: exemptionCertificates.jurisdiction,
          entityUseCode: exemptionCertificates.entityUseCode,
          expiresAt: exemptionCertificates.expiresAt,
          status: exemptionCertificates.status,
        })
        .from(exemptionCertificates)
        .innerJoin(customers, eq(exemptionCertificates.customerId, customers.id))
        .where(eq(customers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: staffUsers.id,
          email: staffUsers.email,
        })
        .from(staffUsers)
        .where(eq(staffUsers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: wholesaleUsers.id,
          email: wholesaleUsers.email,
          customerId: wholesaleUsers.customerId,
        })
        .from(wholesaleUsers)
        .where(eq(wholesaleUsers.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: opsUsers.id,
          email: opsUsers.email,
        })
        .from(opsUsers)
        .where(eq(opsUsers.tenantId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: purchaseOrders.id,
          supplierId: purchaseOrders.supplierId,
          status: purchaseOrders.status,
          documentNumber: purchaseOrders.documentNumber,
          createdAt: purchaseOrders.createdAt,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          purchaseOrderId: purchaseOrderLines.purchaseOrderId,
          sku: purchaseOrderLines.sku,
          qty: purchaseOrderLines.qty,
          receivedQty: purchaseOrderLines.receivedQty,
        })
        .from(purchaseOrderLines)
        .innerJoin(purchaseOrders, eq(purchaseOrderLines.purchaseOrderId, purchaseOrders.id))
        .where(eq(purchaseOrders.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: orders.id,
          customerId: orders.customerId,
          status: orders.status,
          documentNumber: orders.documentNumber,
          createdAt: orders.createdAt,
          shipLine1: orders.shipLine1,
          shipLine2: orders.shipLine2,
          shipCity: orders.shipCity,
          shipRegion: orders.shipRegion,
          shipPostal: orders.shipPostal,
          shipCountry: orders.shipCountry,
        })
        .from(orders)
        .where(eq(orders.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          orderId: orderLines.orderId,
          sku: orderLines.sku,
          qty: orderLines.qty,
          unitPriceCents: orderLines.unitPriceCents,
        })
        .from(orderLines)
        .innerJoin(orders, eq(orderLines.orderId, orders.id))
        .where(eq(orders.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: invoices.id,
          orderId: invoices.orderId,
          customerId: invoices.customerId,
          documentNumber: invoices.documentNumber,
          postedAt: invoices.postedAt,
          subtotalCents: invoices.subtotalCents,
          taxTotalCents: invoices.taxTotalCents,
          totalCents: invoices.totalCents,
        })
        .from(invoices)
        .where(eq(invoices.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          invoiceId: invoiceTaxLines.invoiceId,
        })
        .from(invoiceTaxLines)
        .innerJoin(invoices, eq(invoiceTaxLines.invoiceId, invoices.id))
        .where(eq(invoices.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: payments.id,
          customerId: payments.customerId,
          amountCents: payments.amountCents,
        })
        .from(payments)
        .where(eq(payments.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          paymentId: paymentApplications.paymentId,
          invoiceId: paymentApplications.invoiceId,
          amountCents: paymentApplications.amountCents,
        })
        .from(paymentApplications)
        .innerJoin(payments, eq(paymentApplications.paymentId, payments.id))
        .where(eq(payments.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          id: taxCommits.id,
          invoiceId: taxCommits.invoiceId,
          organizationId: taxCommits.organizationId,
        })
        .from(taxCommits)
        .where(eq(taxCommits.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          sku: stockMovements.sku,
          locationId: stockMovements.locationId,
          movementType: stockMovements.movementType,
          qty: stockMovements.qty,
          createdAt: stockMovements.createdAt,
        })
        .from(stockMovements)
        .where(eq(stockMovements.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          sku: stockSnapshots.sku,
          locationId: stockSnapshots.locationId,
          onHand: stockSnapshots.onHand,
          onOrder: stockSnapshots.onOrder,
          allocated: stockSnapshots.allocated,
        })
        .from(stockSnapshots)
        .where(eq(stockSnapshots.organizationId, DEMO_SEED_ORGANIZATION_ID)),
      this.db
        .select({
          sku: reorderPolicies.sku,
          locationId: reorderPolicies.locationId,
          minOnHand: reorderPolicies.minOnHand,
          maxOnHand: reorderPolicies.maxOnHand,
        })
        .from(reorderPolicies)
        .where(eq(reorderPolicies.organizationId, DEMO_SEED_ORGANIZATION_ID)),
    ]);

    return assembleDemoBook({
      defaultLocationId,
      products: productRows,
      images: imageRows,
      suppliers: supplierRows,
      supplierProducts: supplierProductRows,
      customers: customerRows,
      shipTos: shipToRows,
      contacts: contactRows,
      exemptionCertificates: exemptionRows,
      staffUsers: staffRows,
      wholesaleUsers: wholesaleRows,
      opsUsers: opsRows,
      purchaseOrders: purchaseOrderRows,
      purchaseOrderLines: purchaseOrderLineRows.map((row) => ({
        purchaseOrderId: row.purchaseOrderId,
        sku: row.sku,
        qty: row.qty,
        receivedQty: row.receivedQty,
      })),
      salesOrders: salesOrderRows,
      salesOrderLines: salesOrderLineRows,
      invoices: invoiceRows,
      invoiceTaxLines: invoiceTaxLineRows,
      payments: paymentRows,
      paymentApplications: paymentApplicationRows,
      taxCommits: taxCommitRows,
      movements: movementRows.map((row) => ({
        sku: row.sku,
        locationId: row.locationId,
        movementType: row.movementType,
        quantity: row.qty,
        createdAt: row.createdAt,
      })),
      snapshots: snapshotRows,
      reorderPolicies: reorderPolicyRows,
    });
  }
}
