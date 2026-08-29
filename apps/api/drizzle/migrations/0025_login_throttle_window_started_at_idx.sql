CREATE INDEX IF NOT EXISTS "login_throttle_counters_window_started_at_idx"
  ON "identity"."login_throttle_counters" ("window_started_at");
