ALTER TABLE "identity"."sessions" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "identity"."staff_users" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "identity"."wholesale_users" ADD COLUMN "password_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE no action ON UPDATE no action;