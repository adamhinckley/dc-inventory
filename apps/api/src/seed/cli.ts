import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DrizzleProductRepository,
  type CatalogDrizzle,
} from "@dc-inventory/catalog";
import {
  DrizzleCustomerRepository,
  type CustomersDrizzle,
} from "@dc-inventory/customers";
import {
  DrizzleStaffUserRepository,
  DrizzleWholesaleUserRepository,
  ScryptPasswordHasher,
  type IdentityDrizzle,
} from "@dc-inventory/identity";
import {
  DrizzleSupplierRepository,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import { MissingDatabaseUrlError } from "../infrastructure/database-url.js";
import { createDatabaseConnection } from "../infrastructure/db.js";
import {
  PHASE1_CUSTOMER_NAME,
  PHASE1_PRODUCT_SKUS,
  PHASE1_STAFF_EMAIL,
  PHASE1_SUPPLIER_VENDOR_NUMBER,
  PHASE1_WHOLESALE_EMAIL,
} from "./phase1-fixture.js";
import { Phase1SeedError, runPhase1Seed } from "./run-phase1-seed.js";

function loadLocalEnvFiles(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const envPath of [
    resolve(here, "../../../.env"),
    resolve(here, "../../.env"),
  ]) {
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

loadLocalEnvFiles();

function readSecret(name: "PHASE1_STAFF_PASSWORD" | "PHASE1_WHOLESALE_PASSWORD"): string {
  const value = process.env[name]?.trim() ?? "";
  if (value.length === 0) {
    throw new Phase1SeedError(
      `${name} is missing. Copy the placeholder from apps/api/.env.example — do not commit a real secret.`,
    );
  }
  return value;
}

try {
  const connection = createDatabaseConnection();
  const result = await runPhase1Seed(
    {
      products: new DrizzleProductRepository(connection.db as unknown as CatalogDrizzle),
      customers: new DrizzleCustomerRepository(connection.db as unknown as CustomersDrizzle),
      staffUsers: new DrizzleStaffUserRepository(connection.db as unknown as IdentityDrizzle),
      wholesaleUsers: new DrizzleWholesaleUserRepository(
        connection.db as unknown as IdentityDrizzle,
      ),
      suppliers: new DrizzleSupplierRepository(
        connection.db as unknown as PurchasingDrizzle,
      ),
      passwords: new ScryptPasswordHasher(),
    },
    {
      staffPassword: readSecret("PHASE1_STAFF_PASSWORD"),
      wholesalePassword: readSecret("PHASE1_WHOLESALE_PASSWORD"),
    },
  );
  await connection.sql.end({ timeout: 5 });
  console.log(
    `Phase 1 seed upserted ${PHASE1_CUSTOMER_NAME}, ${PHASE1_STAFF_EMAIL}, ${PHASE1_WHOLESALE_EMAIL}, ${PHASE1_SUPPLIER_VENDOR_NUMBER}, and ${String(PHASE1_PRODUCT_SKUS.length)} SKUs (customer ${result.customer.id}).`,
  );
} catch (error) {
  if (error instanceof MissingDatabaseUrlError || error instanceof Phase1SeedError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
