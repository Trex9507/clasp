-- Agent versions are immutable (CLAUDE.md, I2): a configuration edit inserts a new row.
-- The only column that may change is runtime_synced_version, set when the runtime
-- acknowledges the version. Deletes are left to ON DELETE CASCADE from agents.
CREATE OR REPLACE FUNCTION agent_versions_reject_config_update() RETURNS trigger AS $$
BEGIN
  IF (NEW.id, NEW.agent_id, NEW.version, NEW.model, NEW.language, NEW.effort,
      NEW.system_prompt, NEW.actions, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.id, OLD.agent_id, OLD.version, OLD.model, OLD.language, OLD.effort,
      OLD.system_prompt, OLD.actions, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'agent_versions rows are immutable; insert a new version instead'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER agent_versions_immutable
  BEFORE UPDATE ON agent_versions
  FOR EACH ROW EXECUTE FUNCTION agent_versions_reject_config_update();
