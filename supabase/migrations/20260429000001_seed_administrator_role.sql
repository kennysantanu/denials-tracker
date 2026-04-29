INSERT INTO public.roles (role_name, permissions)
SELECT
  'Administrator',
  jsonb_build_object(
    'view_denials',       true,
    'create_denial',      true,
    'update_denial',      true,
    'delete_denial',      true,
    'view_reports',       true,
    'export_reports',     true,
    'manage_patients',    true,
    'manage_insurances',  true,
    'generate_summary',   true,
    'generate_appeal',    true,
    'manage_users',       true,
    'manage_roles',       true,
    'manage_labels',      true,
    'audit_read',         true,
    'file_upload',        true,
    'file_edit',          true,
    'file_delete',        true,
    'admin',              true
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE role_name = 'Administrator'
);
