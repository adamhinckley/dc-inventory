CREATE TYPE "accounting"."payment_method" AS ENUM('check', 'card', 'ach', 'cash', 'other');
--> statement-breakpoint
CREATE TYPE "accounting"."invoice_adjustment_kind" AS ENUM('write_off', 'credit_memo');
--> statement-breakpoint
CREATE TYPE "accounting"."payment_plan_frequency" AS ENUM('weekly', 'monthly');
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "method" "accounting"."payment_method" DEFAULT 'other' NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "reference" text;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "received_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "accounting"."payments" SET "received_at" = "created_at" WHERE "received_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ALTER COLUMN "received_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "note" text;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "recorded_by" uuid;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "voided_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "voided_by" uuid;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "void_reason" text;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "hold_remainder_as_credit" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "accounting"."payments" ADD COLUMN "idempotency_applications" jsonb DEFAULT '[]' NOT NULL;
--> statement-breakpoint
UPDATE "accounting"."payments" AS p
SET "idempotency_applications" = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object('invoiceId', pa.invoice_id, 'amountCents', pa.amount_cents)
      ORDER BY pa.created_at
    )
    FROM "accounting"."payment_applications" AS pa
    WHERE pa.payment_id = p.id
  ),
  '[]'::jsonb
);
--> statement-breakpoint
DROP TABLE IF EXISTS "accounting"."invoice_tax_lines";
--> statement-breakpoint
ALTER TABLE "accounting"."invoices" DROP COLUMN IF EXISTS "tax_total_cents";
--> statement-breakpoint
ALTER TABLE "accounting"."invoices"
  ADD CONSTRAINT "invoices_organization_id_id_unique"
  UNIQUE ("organization_id", "id");
--> statement-breakpoint
CREATE TABLE "accounting"."invoice_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text DEFAULT 'DEFAULT' NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "accounting"."invoice_adjustment_kind" NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting"."invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_organization_id_invoice_id_invoices_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "accounting"."invoices"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "accounting"."payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text DEFAULT 'DEFAULT' NOT NULL,
	"customer_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"frequency" "accounting"."payment_plan_frequency" NOT NULL,
	"starts_on" date NOT NULL,
	"ended_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting"."payment_plans" ADD CONSTRAINT "payment_plans_organization_id_customer_id_customers_fk" FOREIGN KEY ("organization_id","customer_id") REFERENCES "customers"."customers"("organization_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_plans_organization_id_customer_id_active_unique" ON "accounting"."payment_plans" ("organization_id","customer_id") WHERE "ended_at" IS NULL;
