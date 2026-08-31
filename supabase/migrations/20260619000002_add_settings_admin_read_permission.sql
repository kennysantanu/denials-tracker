-- Separate admin-settings navigation from operational data reads.
--
-- `user.read` and `label.read` are useful to staff-facing workflows, but they
-- should not by themselves expose the Settings > Admin section.

INSERT INTO public.permission_catalog (key, category, description, risk_level, is_kpi_relevant, legacy_keys)
VALUES
  ('admin.read', 'admin', 'Access the admin section in settings.', 'medium', false, ARRAY[]::text[])
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, 'admin.read'
FROM public.roles r
WHERE r.role_name = 'Administrator'
ON CONFLICT DO NOTHING;
