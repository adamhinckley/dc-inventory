ALTER TABLE "customers"."customers"
  ADD CONSTRAINT "customers_organization_id_id_unique"
  UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "sales"."orders"
  ADD CONSTRAINT "orders_organization_id_id_unique"
  UNIQUE ("organization_id", "id");
--> statement-breakpoint
ALTER TABLE "sales"."orders"
  DROP CONSTRAINT "orders_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "accounting"."invoices"
  DROP CONSTRAINT "invoices_order_id_orders_id_fk";
--> statement-breakpoint
ALTER TABLE "accounting"."invoices"
  DROP CONSTRAINT "invoices_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "accounting"."payments"
  DROP CONSTRAINT "payments_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "sales"."orders"
  ADD CONSTRAINT "orders_organization_id_customer_id_customers_fk"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"."customers" ("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "accounting"."invoices"
  ADD CONSTRAINT "invoices_organization_id_order_id_orders_fk"
  FOREIGN KEY ("organization_id", "order_id")
  REFERENCES "sales"."orders" ("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "accounting"."invoices"
  ADD CONSTRAINT "invoices_organization_id_customer_id_customers_fk"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"."customers" ("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "accounting"."payments"
  ADD CONSTRAINT "payments_organization_id_customer_id_customers_fk"
  FOREIGN KEY ("organization_id", "customer_id")
  REFERENCES "customers"."customers" ("organization_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
