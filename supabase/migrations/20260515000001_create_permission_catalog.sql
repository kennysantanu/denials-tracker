-- Phase 1.1 (permission overhaul): permission_catalog
--
-- Canonical, dotted-notation permission keys. Acts as the source-of-truth
-- whitelist for what permissions the app understands. Roles can only grant
-- keys that exist in this table (enforced by FK from role_permissions).
--
-- This migration is additive only - no existing app behavior changes.

CREATE TABLE IF NOT EXISTS public.permission_catalog (
  key text PRIMARY KEY,
  category text NOT NULL,
  description text NOT NULL,
  risk_level text NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'break_glass')),
  is_active boolean NOT NULL DEFAULT true,
  is_kpi_relevant boolean NOT NULL DEFAULT false,
  legacy_keys text[] NOT NULL DEFAULT '{}',
  introduced_at timestamptz NOT NULL DEFAULT now(),
  deprecated_at timestamptz
);

ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;

-- Authenticated app users may read the catalog (the roles UI needs it).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'permission_catalog'
      AND policyname = 'permission_catalog_read_authenticated'
  ) THEN
    CREATE POLICY "permission_catalog_read_authenticated"
      ON public.permission_catalog
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- No INSERT/UPDATE/DELETE policies for `authenticated` - mutations only via
-- service role / migrations during the overhaul.

GRANT SELECT ON public.permission_catalog TO authenticated;
GRANT ALL    ON public.permission_catalog TO service_role;

-- ---------------------------------------------------------------------------
-- Seed canonical permission keys (idempotent).
-- Categories: workflow | reporting | ai | admin | break_glass
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_catalog (key, category, description, risk_level, is_kpi_relevant, legacy_keys) VALUES
  -- Core workflow
  ('dashboard.read',          'workflow',  'View the main dashboard.',                            'low',    true,  ARRAY[]::text[]),
  ('patient.read',            'workflow',  'View patient list and patient detail.',               'medium', true,  ARRAY[]::text[]),
  ('patient.create',          'workflow',  'Create a new patient record.',                        'medium', true,  ARRAY['manage_patients']),
  ('patient.update',          'workflow',  'Edit patient demographics or notes.',                 'medium', true,  ARRAY['manage_patients']),
  ('patient.archive',         'workflow',  'Soft-delete (archive) a patient.',                    'high',   true,  ARRAY['manage_patients']),
  ('denial.read',             'workflow',  'View denial records.',                                'medium', true,  ARRAY['view_denials']),
  ('denial.create',           'workflow',  'Create new denial records.',                          'medium', true,  ARRAY['create_denial']),
  ('denial.update',           'workflow',  'Edit denial fields and status.',                      'medium', true,  ARRAY['update_denial']),
  ('denial.close',            'workflow',  'Mark a denial closed.',                               'medium', true,  ARRAY['update_denial']),
  ('denial.reopen',           'workflow',  'Reopen a closed denial.',                             'medium', true,  ARRAY['update_denial']),
  ('denial.delete',           'workflow',  'Delete a denial record.',                             'high',   true,  ARRAY['delete_denial']),
  ('note.create',             'workflow',  'Add notes to denials.',                               'low',    true,  ARRAY['create_denial']),
  ('note.update',             'workflow',  'Edit existing notes.',                                'low',    true,  ARRAY['update_denial']),
  ('note.delete',             'workflow',  'Delete notes.',                                       'medium', true,  ARRAY['delete_denial']),
  ('file.read',               'workflow',  'View files and attachments.',                         'medium', true,  ARRAY[]::text[]),
  ('file.upload',             'workflow',  'Upload new files / attachments.',                     'medium', true,  ARRAY['file_upload']),
  ('file.update',             'workflow',  'Edit file metadata or notes.',                        'medium', true,  ARRAY['file_edit']),
  ('file.delete',             'workflow',  'Delete files / attachments.',                         'high',   true,  ARRAY['file_delete']),
  ('followup.read',           'workflow',  'View follow-up queue.',                               'low',    true,  ARRAY[]::text[]),
  ('followup.update',         'workflow',  'Update follow-up dates and status.',                  'low',    true,  ARRAY['update_denial']),

  -- Reporting & KPI
  ('report.read',             'reporting', 'View reports.',                                       'low',    false, ARRAY['view_reports']),
  ('report.export',           'reporting', 'Export reports.',                                     'medium', true,  ARRAY['export_reports']),
  ('kpi.read.self',           'reporting', 'View own KPIs.',                                      'low',    false, ARRAY[]::text[]),
  ('kpi.read.team',           'reporting', 'View team KPIs.',                                     'medium', false, ARRAY[]::text[]),
  ('kpi.read.all',            'reporting', 'View KPIs for all users.',                            'medium', false, ARRAY[]::text[]),

  -- AI
  ('ai.chat',                 'ai',        'Use the AI chat assistant.',                          'medium', true,  ARRAY[]::text[]),
  ('ai.rewrite',              'ai',        'Use AI rewrite tools.',                               'medium', true,  ARRAY[]::text[]),
  ('ai.summary',              'ai',        'Generate AI denial summaries.',                       'medium', true,  ARRAY['generate_summary']),
  ('ai.appeal',               'ai',        'Generate AI appeal letters.',                         'medium', true,  ARRAY['generate_appeal']),
  ('ai.query_denials',        'ai',        'Query denials via AI tools.',                         'medium', true,  ARRAY[]::text[]),

  -- Administration
  ('user.read',               'admin',     'View user list.',                                     'medium', false, ARRAY['manage_users']),
  ('user.create',             'admin',     'Create new users.',                                   'high',   false, ARRAY['manage_users']),
  ('user.update',             'admin',     'Update user accounts and role assignments.',          'high',   false, ARRAY['manage_users']),
  ('user.delete',             'admin',     'Delete users.',                                       'high',   false, ARRAY['manage_users']),
  ('role.read',               'admin',     'View roles and their permissions.',                   'medium', false, ARRAY['manage_roles']),
  ('role.create',             'admin',     'Create new roles.',                                   'high',   false, ARRAY['manage_roles']),
  ('role.update',             'admin',     'Update role permissions.',                            'high',   false, ARRAY['manage_roles']),
  ('role.delete',             'admin',     'Delete roles.',                                       'high',   false, ARRAY['manage_roles']),
  ('permission.read',         'admin',     'View the permission catalog.',                        'low',    false, ARRAY['manage_roles']),
  ('permission.update',       'admin',     'Modify role-permission grants.',                      'high',   false, ARRAY['manage_roles']),
  ('label.read',              'admin',     'View labels.',                                        'low',    false, ARRAY['manage_labels']),
  ('label.create',            'admin',     'Create labels.',                                      'medium', false, ARRAY['manage_labels']),
  ('label.update',            'admin',     'Update labels.',                                      'medium', false, ARRAY['manage_labels']),
  ('label.delete',            'admin',     'Delete labels.',                                      'medium', false, ARRAY['manage_labels']),
  ('insurance.read',          'admin',     'View insurances.',                                    'low',    false, ARRAY['manage_insurances']),
  ('insurance.create',        'admin',     'Create insurances.',                                  'medium', false, ARRAY['manage_insurances']),
  ('insurance.update',        'admin',     'Update insurances.',                                  'medium', false, ARRAY['manage_insurances']),
  ('insurance.delete',        'admin',     'Delete insurances.',                                  'medium', false, ARRAY['manage_insurances']),
  ('system_preferences.read', 'admin',     'View system preferences.',                            'medium', false, ARRAY[]::text[]),
  ('system_preferences.update','admin',    'Modify system preferences.',                          'high',   false, ARRAY[]::text[]),
  ('audit.read',              'admin',     'View audit log entries.',                             'high',   true,  ARRAY['audit_read']),
  ('audit.export',            'admin',     'Export audit log entries.',                           'high',   true,  ARRAY['audit_read']),

  -- Break glass
  ('break_glass.admin',       'break_glass','Emergency superuser override. Always logged.',       'break_glass', true, ARRAY['admin'])
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_permission_catalog_category ON public.permission_catalog(category);
CREATE INDEX IF NOT EXISTS idx_permission_catalog_active   ON public.permission_catalog(is_active) WHERE is_active;
