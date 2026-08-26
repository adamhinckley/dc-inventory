import {
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Operator-bridge persistence models. Local facts only — IOperatorPlatform stays no-op.
 * operator_outbox.payload is the only Phase 0 JSONB. No Kafka. No inventory outbox.
 */
export const operatorBridge = pgSchema("operator_bridge");

export const issueActorType = operatorBridge.enum("issue_actor_type", [
  "staff",
  "ops",
  "wholesale",
]);

export const issueSurface = operatorBridge.enum("issue_surface", [
  "internal",
  "ops",
  "wholesale",
]);

export const issueReportStatus = operatorBridge.enum("issue_report_status", [
  "new",
  "queued",
  "forwarded",
  "forward_failed",
]);

export const operatorOutboxKind = operatorBridge.enum("operator_outbox_kind", [
  "license.snapshot",
  "income.recorded",
  "issue.reported",
  "heartbeat",
]);

function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  };
}

export const issueReports = operatorBridge.table("issue_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  summary: text("summary").notNull(),
  details: text("details"),
  actorType: issueActorType("actor_type").notNull(),
  surface: issueSurface("surface").notNull(),
  requestId: text("request_id"),
  releaseSha: text("release_sha"),
  status: issueReportStatus("status").notNull(),
  ...timestamps(),
});

/** Fail-soft envelope. Closed kinds only. */
export const operatorOutbox = operatorBridge.table(
  "operator_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productCode: text("product_code").notNull().default("dc-inventory"),
    installationId: uuid("installation_id").notNull(),
    tenantId: text("tenant_id").notNull().default("DEFAULT"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
      .notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    kind: operatorOutboxKind("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("operator_outbox_tenant_id_idempotency_key_unique").on(
      table.tenantId,
      table.idempotencyKey,
    ),
  ],
);
