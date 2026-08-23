ALTER TABLE "customers"."contacts" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "customers"."contacts" ADD COLUMN "email" text NOT NULL;--> statement-breakpoint
ALTER TABLE "customers"."contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "customers"."exemption_certificates" ALTER COLUMN "object_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "customers"."contacts" ADD CONSTRAINT "contacts_customer_id_email_unique" UNIQUE("customer_id","email");
