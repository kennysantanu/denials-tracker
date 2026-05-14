-- Phase 5 supplement: legacy compatibility mappings for AI canonical keys
--
-- The new `ai.chat`, `ai.rewrite`, and `ai.query_denials` permissions have no
-- legacy equivalents in `permission_catalog`. Without compat-map entries, any
-- role that historically had AI access via the legacy permissions JSON will
-- be denied in dual-read mode (since neither store grants the new keys).
--
-- These entries preserve existing behavior during the transition: anyone who
-- could generate AI summaries or appeals (`generate_summary` / `generate_appeal`)
-- gets `ai.chat` and `ai.rewrite`, and anyone who could view denials gets the
-- `ai.query_denials` tool. After Phase 8 cutover (engine = 'new'), admins
-- should explicitly grant these via the new role permissions UI.

INSERT INTO public.permission_compatibility_map (legacy_key, permission_key, direction, notes) VALUES
  ('generate_summary',  'ai.chat',           'legacy_to_new', 'transitional: AI users keep chat'),
  ('generate_summary',  'ai.rewrite',        'legacy_to_new', 'transitional: AI users keep rewrite'),
  ('generate_summary',  'ai.query_denials',  'legacy_to_new', 'transitional: AI users keep tool'),
  ('generate_appeal',   'ai.chat',           'legacy_to_new', 'transitional: AI users keep chat'),
  ('generate_appeal',   'ai.rewrite',        'legacy_to_new', 'transitional: AI users keep rewrite'),
  ('view_denials',      'ai.query_denials',  'legacy_to_new', 'transitional: tool was gated on view_denials')
ON CONFLICT (legacy_key, permission_key, direction) DO NOTHING;
