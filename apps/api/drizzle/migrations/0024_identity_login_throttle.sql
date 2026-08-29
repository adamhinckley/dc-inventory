CREATE TABLE IF NOT EXISTS "identity"."login_throttle_counters" (
  "audience" "identity"."actor_type" NOT NULL,
  "source_hash" text NOT NULL,
  "account_identifier_hash" text NOT NULL,
  "attempt_count" integer NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "login_throttle_counters_pk"
    PRIMARY KEY ("audience", "source_hash", "account_identifier_hash")
);
