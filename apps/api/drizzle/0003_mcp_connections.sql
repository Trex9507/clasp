CREATE TYPE "public"."mcp_auth_type" AS ENUM('none', 'bearer');--> statement-breakpoint
CREATE TYPE "public"."mcp_connection_status" AS ENUM('unchecked', 'ok', 'error');--> statement-breakpoint
CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"auth_type" "mcp_auth_type" NOT NULL,
	"credential_encrypted" text,
	"runtime_credential_id" text,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "mcp_connection_status" DEFAULT 'unchecked' NOT NULL,
	"last_error" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_connections_workspace_id_url_unique" UNIQUE("workspace_id","url")
);
--> statement-breakpoint
CREATE TABLE "runtime_vaults" (
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"vault_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runtime_vaults_workspace_id_provider_pk" PRIMARY KEY("workspace_id","provider")
);
--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_vaults" ADD CONSTRAINT "runtime_vaults_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;