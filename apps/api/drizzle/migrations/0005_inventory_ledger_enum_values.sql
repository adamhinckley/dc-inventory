-- Phase 2 inventory ledger enum values (ADA-108). Commit before identity indexes.

ALTER TYPE "inventory"."movement_type" ADD VALUE IF NOT EXISTS 'InboundCancelled';--> statement-breakpoint
ALTER TYPE "inventory"."movement_type" ADD VALUE IF NOT EXISTS 'AdjustmentIncrease';--> statement-breakpoint
ALTER TYPE "inventory"."movement_type" ADD VALUE IF NOT EXISTS 'AdjustmentDecrease';--> statement-breakpoint
ALTER TYPE "inventory"."movement_ref_type" ADD VALUE IF NOT EXISTS 'adjustment';
