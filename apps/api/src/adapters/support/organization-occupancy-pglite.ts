import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  DeleteOrganizationUseCase,
  DrizzleOrganizationRepository,
  DrizzleSessionStore,
  DrizzleStaffUserRepository,
  type IdentityDrizzle,
  type OrganizationDrizzle,
} from "@dc-inventory/identity";
import { DeleteOrganizationWithOccupancyUseCase } from "../../application/delete-organization-with-occupancy.js";
import { DrizzleOrganizationOccupancyReadPort } from "../drizzle-organization-occupancy-read-port.js";
import { schema } from "../../infrastructure/schema.js";
import type { AppDrizzle } from "../../infrastructure/db.js";
import * as identitySchema from "@dc-inventory/identity/schema";

export async function execOrganizationOccupancySchema(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA identity;
    CREATE SCHEMA catalog;
    CREATE SCHEMA customers;
    CREATE SCHEMA sales;
    CREATE SCHEMA purchasing;
    CREATE SCHEMA inventory;

    CREATE TABLE identity.organizations (
      id text PRIMARY KEY,
      name text NOT NULL,
      slug text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE identity.platform_users (
      id uuid PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE identity.staff_users (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      display_name text NOT NULL,
      email text NOT NULL,
      password_hash text NOT NULL,
      roles text[] NOT NULL DEFAULT ARRAY['admin'],
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TYPE identity.actor_type AS ENUM ('staff', 'wholesale', 'ops', 'platform');
    CREATE TABLE identity.sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type identity.actor_type NOT NULL,
      actor_id uuid NOT NULL,
      staff_user_id uuid,
      platform_user_id uuid,
      organization_id text,
      customer_id uuid,
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE catalog.products (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      sku text NOT NULL,
      name text NOT NULL,
      uom text NOT NULL,
      member_price_cents bigint NOT NULL,
      currency char(3) NOT NULL DEFAULT 'USD',
      inactive boolean NOT NULL DEFAULT false,
      discontinued boolean NOT NULL DEFAULT false,
      non_stock boolean NOT NULL DEFAULT false,
      no_export boolean NOT NULL DEFAULT false,
      web_wholesale boolean NOT NULL DEFAULT false,
      web_retail boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE catalog.categories (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE customers.customers (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      name text NOT NULL,
      customer_number text NOT NULL,
      credit_limit_cents bigint NOT NULL,
      currency char(3) NOT NULL DEFAULT 'USD',
      terms text NOT NULL,
      account_status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE sales.orders (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      customer_id uuid NOT NULL,
      status text NOT NULL,
      document_number text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE purchasing.suppliers (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      vendor_number text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE purchasing.purchase_orders (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      supplier_id uuid NOT NULL,
      status text NOT NULL,
      document_number text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE inventory.locations (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      code text NOT NULL,
      is_pick_bin boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE inventory.stock_snapshots (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      sku text NOT NULL,
      location_id uuid NOT NULL REFERENCES inventory.locations(id),
      on_hand integer NOT NULL DEFAULT 0,
      allocated integer NOT NULL DEFAULT 0,
      on_order integer NOT NULL DEFAULT 0,
      committed integer NOT NULL DEFAULT 0,
      sticky_locked boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TYPE inventory.movement_type AS ENUM ('InboundFromPo');
    CREATE TYPE inventory.movement_ref_type AS ENUM ('PurchaseOrder');
    CREATE TABLE inventory.stock_movements (
      id uuid PRIMARY KEY,
      organization_id text NOT NULL,
      sku text NOT NULL,
      location_id uuid NOT NULL REFERENCES inventory.locations(id),
      movement_type inventory.movement_type NOT NULL,
      qty integer NOT NULL,
      ref_type inventory.movement_ref_type NOT NULL,
      ref_id uuid NOT NULL,
      idempotency_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function createOrganizationOccupancyHarness() {
  const client = new PGlite();
  await execOrganizationOccupancySchema(client);
  const db = drizzle(client, { schema: { ...schema, ...identitySchema } }) as unknown as AppDrizzle;
  const organizationDb = drizzle(client, { schema: identitySchema }) as unknown as OrganizationDrizzle;
  const identityDb = organizationDb as unknown as IdentityDrizzle;
  const organizations = new DrizzleOrganizationRepository(organizationDb);
  const staffUsers = new DrizzleStaffUserRepository(identityDb);
  const sessions = new DrizzleSessionStore(identityDb);
  const occupancy = new DrizzleOrganizationOccupancyReadPort(db);
  const deleteOrganization = new DeleteOrganizationUseCase(organizations, staffUsers, sessions);
  const deleteWithOccupancy = new DeleteOrganizationWithOccupancyUseCase(
    organizations,
    occupancy,
    deleteOrganization,
  );
  return { client, db, organizations, staffUsers, sessions, occupancy, deleteWithOccupancy };
}
