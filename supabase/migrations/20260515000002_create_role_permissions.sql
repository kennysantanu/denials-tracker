-- Phase 1.2 (permission overhaul): role_permissions
--
-- Normalized join between roles and the canonical permission_catalog.
-- During the dual-write transition this is the source-of-truth for the new
-- permission engine. The legacy `roles.permissions` JSONB column is
-- regenerated from this table by the admin UI.

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id bigint NOT NULL REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permission_catalog(key) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Read access for any authenticated user (the app layer needs this to load
-- effective permissions on every request). Mutations stay locked down to
-- service-role / migrations during the overhaul; the dual-write admin UI
-- (Phase 4) will route writes through a SECURITY DEFINER function.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'role_permissions'
      AND policyname = 'role_permissions_read_authenticated'
  ) THEN
    CREATE POLICY "role_permissions_read_authenticated"
      ON public.role_permissions
      AS PERMISSIVE FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL    ON public.role_permissions TO service_role;

CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key
  ON public.role_permissions(permission_key);
