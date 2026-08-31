-- Seed the admin-configurable AI chat thinking level.

INSERT INTO public.preferences (name, value, data_type)
VALUES ('ai_reasoning_effort', 'low', 'string')
ON CONFLICT (name) DO UPDATE
SET
  value = COALESCE(public.preferences.value, EXCLUDED.value),
  data_type = EXCLUDED.data_type;
