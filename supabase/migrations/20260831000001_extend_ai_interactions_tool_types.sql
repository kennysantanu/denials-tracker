-- AI tool consolidation (Phase 1 of plans/AI_TOOL_ARCHITECTURE_PLAN.md):
-- allow the interaction types emitted by the new search_patients and
-- search_denials tools. Legacy values remain valid for historical rows.

ALTER TABLE ai_interactions DROP CONSTRAINT IF EXISTS ai_interactions_interaction_type_check;

ALTER TABLE ai_interactions
  ADD CONSTRAINT ai_interactions_interaction_type_check
  CHECK (interaction_type IN (
    'chat',
    'summary_tool',
    'appeal_tool',
    'query_tool',
    'patient_search_tool',
    'denial_search_tool'
  ));
