CREATE TYPE "identity"."set_password_audience" AS ENUM ('staff', 'wholesale', 'platform');

CREATE TABLE IF NOT EXISTS "identity"."set_password_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" text NOT NULL,
  "audience" "identity"."set_password_audience" NOT NULL,
  "user_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "set_password_tokens_token_hash_unique"
  ON "identity"."set_password_tokens" ("token_hash");

CREATE INDEX IF NOT EXISTS "set_password_tokens_expires_at_idx"
  ON "identity"."set_password_tokens" ("expires_at");
