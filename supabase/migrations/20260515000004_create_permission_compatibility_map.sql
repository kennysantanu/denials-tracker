-- Phase 1.4 (permission overhaul): permission_compatibility_map
--
-- Bidirectional mapping between legacy snake_case permission keys (still
-- stored in `roles.permissions`) and canonical dotted permissions in
-- `permission_catalog`. The dual-read `authorize()` service uses
-- direction='legacy_to_new' to grant access; the dual-write admin UI uses
-- direction='new_to_legacy' to regenerate the legacy JSONB column.
--
-- A legacy key may map to MANY canonical keys (e.g. `manage_users` expands
-- to user.read/create/update/delete) and a canonical key may be granted by
-- multiple legacy keys. Direction='both' is a convenience for 1-to-1 maps.
--
-- IMPORTANT: legacy `admin` maps ONLY to `break_glass.admin` per scope
-- decision. It does NOT auto-grant the new admin permissions.

CREATE TABLE IF NOT EXISTS public.permission_compatibility_map (
  legacy_key text NOT NULL,
  permission_key text NOT NULL REFERENCES public.permission_catalog(key) ON UPDATE CASCADE ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('legacy_to_new', 'new_to_legacy', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  PRIMARY KEY (legacy_key, permission_key, direction)
);

ALTER TABLE public.permission_compatibility_map ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'permission_compatibility_map'
      AND policyname = 'permission_compatibility_map_read_authenticated'
  ) THEN
    CREATE POLICY "permission_compatibility_map_read_authenticated"
      ON public.permission_compatibility_map
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.permission_compatibility_map TO authenticated;
GRANT ALL    ON public.permission_compatibility_map TO service_role;

CREATE INDEX IF NOT EXISTS idx_permission_compatibility_legacy
  ON public.permission_compatibility_map(legacy_key) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_permission_compatibility_canonical
  ON public.permission_compatibility_map(permission_key) WHERE is_active;

-- ---------------------------------------------------------------------------
-- Seed legacy_to_new mappings (idempotent). Mirrors the table in
-- plans/PERMISSION_REVIEW.md "Legacy-to-new compatibility examples".
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_compatibility_map (legacy_key, permission_key, direction) VALUES
  ('view_denials',      'denial.read',          'both'),
  ('create_denial',     'denial.create',        'legacy_to_new'),
  ('create_denial',     'note.create',          'legacy_to_new'),
  ('update_denial',     'denial.update',        'legacy_to_new'),
  ('update_denial',     'denial.close',         'legacy_to_new'),
  ('update_denial',     'denial.reopen',        'legacy_to_new'),
  ('update_denial',     'note.update',          'legacy_to_new'),
  ('update_denial',     'followup.update',      'legacy_to_new'),
  ('delete_denial',     'denial.delete',        'legacy_to_new'),
  ('delete_denial',     'note.delete',          'legacy_to_new'),
  ('view_reports',      'report.read',          'both'),
  ('export_reports',    'report.export',        'both'),
  ('manage_patients',   'patient.create',       'legacy_to_new'),
  ('manage_patients',   'patient.update',       'legacy_to_new'),
  ('manage_patients',   'patient.archive',      'legacy_to_new'),
  ('manage_patients',   'patient.read',         'legacy_to_new'),
  ('manage_insurances', 'insurance.read',       'legacy_to_new'),
  ('manage_insurances', 'insurance.create',     'legacy_to_new'),
  ('manage_insurances', 'insurance.update',     'legacy_to_new'),
  ('manage_insurances', 'insurance.delete',     'legacy_to_new'),
  ('generate_summary',  'ai.summary',           'both'),
  ('generate_appeal',   'ai.appeal',            'both'),
  ('manage_users',      'user.read',            'legacy_to_new'),
  ('manage_users',      'user.create',          'legacy_to_new'),
  ('manage_users',      'user.update',          'legacy_to_new'),
  ('manage_users',      'user.delete',          'legacy_to_new'),
  ('manage_roles',      'role.read',            'legacy_to_new'),
  ('manage_roles',      'role.create',          'legacy_to_new'),
  ('manage_roles',      'role.update',          'legacy_to_new'),
  ('manage_roles',      'role.delete',          'legacy_to_new'),
  ('manage_roles',      'permission.read',      'legacy_to_new'),
  ('manage_roles',      'permission.update',    'legacy_to_new'),
  ('manage_labels',     'label.read',           'legacy_to_new'),
  ('manage_labels',     'label.create',         'legacy_to_new'),
  ('manage_labels',     'label.update',         'legacy_to_new'),
  ('manage_labels',     'label.delete',         'legacy_to_new'),
  ('audit_read',        'audit.read',           'both'),
  ('audit_read',        'audit.export',         'legacy_to_new'),
  ('file_upload',       'file.upload',          'both'),
  ('file_edit',         'file.update',          'both'),
  ('file_delete',       'file.delete',          'both'),
  ('admin',             'break_glass.admin',    'both')
ON CONFLICT (legacy_key, permission_key, direction) DO NOTHING;
