CREATE TABLE IF NOT EXISTS "identity"."login_throttle_counters" (
  "audience" "identity"."actor_type" NOT NULL,
  "dimension" text NOT NULL,
  "key_hash" text NOT NULL,
  "attempt_count" integer NOT NULL,
  "window_started_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "login_throttle_counters_pk"
    PRIMARY KEY ("audience", "dimension", "key_hash"),
  CONSTRAINT "login_throttle_counters_dimension_check"
    CHECK ("dimension" IN ('source', 'account_identifier'))
);
