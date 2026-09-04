ALTER TABLE "identity"."sessions" ADD COLUMN IF NOT EXISTS "staff_user_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_staff_user_id_staff_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "identity"."staff_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
