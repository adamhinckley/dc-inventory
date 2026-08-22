CREATE SCHEMA "licensing";
--> statement-breakpoint
CREATE SCHEMA "operator_bridge";
--> statement-breakpoint
CREATE TYPE "licensing"."add_on_grant_source" AS ENUM('purchased', 'complementary');--> statement-breakpoint
CREATE TYPE "licensing"."flag_override_direction" AS ENUM('force_on', 'force_off');--> statement-breakpoint
CREATE TYPE "operator_bridge"."issue_actor_type" AS ENUM('staff', 'ops', 'wholesale');--> statement-breakpoint
CREATE TYPE "operator_bridge"."issue_report_status" AS ENUM('new', 'queued', 'forwarded', 'forward_failed');--> statement-breakpoint
CREATE TYPE "operator_bridge"."issue_surface" AS ENUM('internal', 'ops', 'wholesale');--> statement-breakpoint
CREATE TYPE "operator_bridge"."operator_outbox_kind" AS ENUM('license.snapshot', 'income.recorded', 'issue.reported', 'heartbeat');--> statement-breakpoint
CREATE TYPE "licensing"."software_payment_kind" AS ENUM('subscription', 'add_on', 'manual');--> statement-breakpoint
CREATE TYPE "licensing"."software_payment_provider" AS ENUM('stripe', 'manual');--> statement-breakpoint
CREATE TYPE "licensing"."software_payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "licensing"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "licensing"."add_on_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"add_on_id" text NOT NULL,
	"source" "licensing"."add_on_grant_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "licensing"."flag_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"feature_name" text NOT NULL,
	"direction" "licensing"."flag_override_direction" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_bridge"."issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"summary" text NOT NULL,
	"details" text,
	"actor_type" "operator_bridge"."issue_actor_type" NOT NULL,
	"surface" "operator_bridge"."issue_surface" NOT NULL,
	"request_id" text,
	"release_sha" text,
	"status" "operator_bridge"."issue_report_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_bridge"."operator_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" text DEFAULT 'dc-inventory' NOT NULL,
	"installation_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'DEFAULT' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" "operator_bridge"."operator_outbox_kind" NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operator_outbox_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "licensing"."software_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'DEFAULT' NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "licensing"."software_payment_status" NOT NULL,
	"kind" "licensing"."software_payment_kind" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"provider" "licensing"."software_payment_provider" NOT NULL,
	"provider_ref" text,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "software_payments_provider_ref_unique" UNIQUE("provider_ref")
);
--> statement-breakpoint
CREATE TABLE "licensing"."subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'DEFAULT' NOT NULL,
	"plan" text NOT NULL,
	"status" "licensing"."subscription_status" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "licensing"."add_on_grants" ADD CONSTRAINT "add_on_grants_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "licensing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licensing"."flag_overrides" ADD CONSTRAINT "flag_overrides_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "licensing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licensing"."software_payments" ADD CONSTRAINT "software_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "licensing"."subscriptions"("id") ON DELETE no action ON UPDATE no action;