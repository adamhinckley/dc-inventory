-- Multi-cart: a customer may hold many open drafts; each gets an optional buyer-chosen label.
DROP INDEX IF EXISTS "sales"."orders_organization_id_customer_id_draft_unique";
--> statement-breakpoint
ALTER TABLE "sales"."orders" ADD COLUMN IF NOT EXISTS "label" text;
