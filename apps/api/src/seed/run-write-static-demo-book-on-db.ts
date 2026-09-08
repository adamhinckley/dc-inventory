import { and, eq } from "drizzle-orm";
import {
  DrizzleProductRepository,
  type CatalogDrizzle,
} from "@dc-inventory/catalog";
import {
  DrizzleCustomerRepository,
  DrizzleExemptionCertificateRepository,
  DrizzleShipToRepository,
  type CustomersDrizzle,
} from "@dc-inventory/customers";
import {
  DrizzleOrganizationRepository,
  DrizzleStaffUserRepository,
  DrizzleWholesaleUserRepository,
  ScryptPasswordHasher,
  type IdentityDrizzle,
} from "@dc-inventory/identity";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_NAME,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
} from "@dc-inventory/inventory";
import { locations } from "@dc-inventory/inventory/schema";
import { DrizzleSupplierRepository } from "@dc-inventory/purchasing";
import { SupplierId } from "@dc-inventory/shared-kernel";
import type { AppDrizzle } from "../infrastructure/db.js";
import { DEMO_SEED_ORGANIZATION_ID } from "./demo-seed-organization.js";
import type { DemoBookPlan } from "./planner/types.js";
import { DrizzleProductImageSeedRepository } from "./ports/drizzle-product-image-seed.js";
import { DrizzleSupplierProductSeedRepository } from "./ports/drizzle-supplier-product-seed.js";
import type { StaticDemoSeedPorts } from "./ports/static-seed-types.js";
import {
  runWriteStaticDemoBook,
  type StaticDemoSeedResult,
  type WriteStaticDemoBookOptions,
} from "./write-static-demo-book.js";
import type { Phase1SeedSecrets } from "./run-phase1-seed.js";

/**
 * Wire Postgres adapters for static demo seeding. `phase2Bootstrap` and `suppliers`
 * share one `ISupplierRepository` so VEND-001 from bootstrap matches supplier upserts.
 */
export async function runWriteStaticDemoBookOnDb(
  db: AppDrizzle,
  plan: DemoBookPlan,
  secrets: Phase1SeedSecrets,
  options: WriteStaticDemoBookOptions = {},
): Promise<StaticDemoSeedResult> {
  const suppliers = new DrizzleSupplierRepository(db as never);
  const ports: StaticDemoSeedPorts = {
    products: new DrizzleProductRepository(db as CatalogDrizzle),
    productImages: new DrizzleProductImageSeedRepository(db as never),
    customers: new DrizzleCustomerRepository(db as unknown as CustomersDrizzle),
    shipTos: new DrizzleShipToRepository(db as unknown as CustomersDrizzle),
    exemptionCertificates: new DrizzleExemptionCertificateRepository(
      db as unknown as CustomersDrizzle,
    ),
    organizations: new DrizzleOrganizationRepository(db as unknown as IdentityDrizzle),
    staffUsers: new DrizzleStaffUserRepository(db as unknown as IdentityDrizzle),
    wholesaleUsers: new DrizzleWholesaleUserRepository(db as unknown as IdentityDrizzle),
    passwords: new ScryptPasswordHasher(),
    suppliers,
    supplierProducts: new DrizzleSupplierProductSeedRepository(db as never),
    phase2Bootstrap: {
      async upsertDefaultLocation() {
        const existing = await db
          .select({ id: locations.id, code: locations.code })
          .from(locations)
          .where(
            and(
              eq(locations.organizationId, DEMO_SEED_ORGANIZATION_ID),
              eq(locations.code, PHASE2_DEFAULT_LOCATION_CODE),
            ),
          )
          .limit(1);
        if (existing[0] !== undefined) {
          return existing[0];
        }
        const inserted = await db
          .insert(locations)
          .values({
            code: PHASE2_DEFAULT_LOCATION_CODE,
            organizationId: DEMO_SEED_ORGANIZATION_ID,
          })
          .returning({ id: locations.id, code: locations.code });
        return inserted[0]!;
      },
      async upsertPrerequisiteSupplier() {
        const existing = await suppliers.findByVendorNumber(
          DEMO_SEED_ORGANIZATION_ID,
          PHASE2_SUPPLIER_VENDOR_NUMBER,
        );
        if (existing !== null) {
          return { id: existing.id, vendorNumber: existing.vendorNumber };
        }
        const id = SupplierId.parse(crypto.randomUUID());
        await suppliers.save({
          id,
          organizationId: DEMO_SEED_ORGANIZATION_ID,
          vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
          name: PHASE2_SUPPLIER_NAME,
          poPrefix: null,
        });
        return { id, vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER };
      },
    },
  };

  return runWriteStaticDemoBook(ports, plan, secrets, options);
}
