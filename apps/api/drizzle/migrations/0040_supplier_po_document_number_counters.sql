CREATE TABLE "purchasing"."supplier_po_document_number_counters" (
	"organization_id" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"last_value" integer NOT NULL,
	CONSTRAINT "supplier_po_document_number_counters_organization_id_supplier_id_pk" PRIMARY KEY("organization_id","supplier_id")
);
--> statement-breakpoint
ALTER TABLE "purchasing"."supplier_po_document_number_counters" ADD CONSTRAINT "supplier_po_document_number_counters_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "purchasing"."suppliers"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
DROP TABLE IF EXISTS "purchasing"."document_number_counters";
