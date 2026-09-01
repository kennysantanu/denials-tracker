-- Phase 2 of plans/AI_TOOL_ARCHITECTURE_PLAN.md: optional office wiki search.
--  1. wiki.read permission (granted through existing role administration;
--     never granted automatically).
--  2. wiki_enabled system preference, default false. The wiki path itself is
--     deployment configuration (WIKI_PATH env var), not an app preference.
--  3. ai_interactions CHECK extended for the wiki_search_tool type.

INSERT INTO public.permission_catalog (key, category, description, risk_level, is_kpi_relevant, legacy_keys)
VALUES ('wiki.read', 'ai', 'Search the office wiki via AI tools.', 'medium', true, ARRAY[]::text[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.preferences (name, value, data_type)
VALUES ('wiki_enabled', 'false', 'boolean')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE ai_interactions DROP CONSTRAINT IF EXISTS ai_interactions_interaction_type_check;

ALTER TABLE ai_interactions
  ADD CONSTRAINT ai_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'chat',
    'summary_tool',
    'appeal_tool',
    'query_tool',
    'patient_search_tool',
    'denial_search_tool',
    'wiki_search_tool'
  ));
