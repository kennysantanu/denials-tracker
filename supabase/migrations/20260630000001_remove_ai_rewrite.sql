-- Remove the AI note rewrite feature while preserving historical audit/event rows.

DELETE FROM public.role_permissions
WHERE permission_key = 'ai.rewrite';

DELETE FROM public.permission_compatibility_map
WHERE permission_key = 'ai.rewrite';

UPDATE public.permission_catalog
SET
  is_active = false,
  deprecated_at = COALESCE(deprecated_at, now())
WHERE key = 'ai.rewrite';

DELETE FROM public.preferences
WHERE name = 'ai_rewrite_system_prompt';
