CREATE TYPE "public"."agent_effort" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."agent_visibility" AS ENUM('private', 'workspace', 'listed');--> statement-breakpoint
CREATE TABLE "agent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"model" text NOT NULL,
	"language" text NOT NULL,
	"effort" "agent_effort" NOT NULL,
	"system_prompt" text NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"runtime_synced_version" integer,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_versions_agent_id_version_unique" UNIQUE("agent_id","version")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"visibility" "agent_visibility" DEFAULT 'private' NOT NULL,
	"current_version_id" uuid,
	"runtime_ref" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_current_version_id_agent_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."agent_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_workspace_id_status_index" ON "agents" USING btree ("workspace_id","status");