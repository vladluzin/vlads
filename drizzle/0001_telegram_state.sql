CREATE TABLE "telegram_state" (
	"telegram_id" bigint PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"step" text DEFAULT 'name' NOT NULL,
	"draft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conversation_id" uuid
);
--> statement-breakpoint
ALTER TABLE "telegram_state" ADD CONSTRAINT "telegram_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_state" ADD CONSTRAINT "telegram_state_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;