CREATE TYPE "inventory"."sell_window_status" AS ENUM('scheduled', 'open', 'closed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."sell_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"filter_snapshot" jsonb NOT NULL,
	"window_opens_at" timestamp with time zone,
	"window_closes_at" timestamp with time zone NOT NULL,
	"status" "inventory"."sell_window_status" NOT NULL,
	"manually_closed_at" timestamp with time zone,
	"applied_by" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL,
	"sku_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory"."sell_window_skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"sell_window_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "inventory"."sell_window_skus" ADD CONSTRAINT "sell_window_skus_sell_window_id_sell_windows_id_fk" FOREIGN KEY ("sell_window_id") REFERENCES "inventory"."sell_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sell_window_skus_organization_id_sell_window_id_sku_unique" ON "inventory"."sell_window_skus" ("organization_id","sell_window_id","sku");
