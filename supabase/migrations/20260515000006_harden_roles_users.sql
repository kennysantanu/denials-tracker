-- Phase 1.6 (permission overhaul): harden roles + users for coexistence
--
-- Additive only. Adds metadata columns, a case-insensitive uniqueness
-- guarantee on role names, a JSON-object check on legacy permissions, and
-- a trigger that blocks deleting a role still referenced by an active
-- assignment in user_role_assignments OR by users.role.

-- --- roles metadata ---------------------------------------------------------
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_system   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_default  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz;

-- Mark the seeded Administrator role as a system role.
UPDATE public.roles
   SET is_system = true
 WHERE role_name = 'Administrator'
   AND is_system = false;

-- updated_at trigger (reuse the project's existing function from
-- 20260409000001_add_tracking_fields.sql).
DROP TRIGGER IF EXISTS set_roles_updated_at ON public.roles;
CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- --- case-insensitive unique role name --------------------------------------
-- Guarded so the migration succeeds even if duplicates somehow exist; surface
-- a clear error rather than partially applying.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT lower(role_name) AS lname, count(*) AS c
    FROM public.roles
    GROUP BY lower(role_name)
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create unique index roles_role_name_lower_uniq: % case-insensitive duplicate role name(s) exist. Resolve them and re-run.',
      dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS roles_role_name_lower_uniq
  ON public.roles (lower(role_name));

-- --- JSON-object check on legacy permissions --------------------------------
-- `roles.permissions` must be either NULL or a JSON object (not array, not
-- scalar). Existing code always writes objects, so this is a tightening.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'roles_permissions_object_check'
  ) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_permissions_object_check
      CHECK (permissions IS NULL OR jsonb_typeof(permissions) = 'object')
      NOT VALID;
    -- Validate separately so a bad row produces a clear failure message.
    ALTER TABLE public.roles VALIDATE CONSTRAINT roles_permissions_object_check;
  END IF;
END $$;

-- --- trigger: block deletion when the role is in active use -----------------
CREATE OR REPLACE FUNCTION public.prevent_in_use_role_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_assignments integer;
  legacy_users       integer;
BEGIN
  SELECT count(*) INTO active_assignments
    FROM public.user_role_assignments
   WHERE role_id = OLD.id
     AND revoked_at IS NULL;

  SELECT count(*) INTO legacy_users
    FROM public.users
   WHERE role = OLD.id;

  IF active_assignments > 0 OR legacy_users > 0 THEN
    RAISE EXCEPTION
      'Cannot delete role % (id=%): still assigned to % active assignment(s) and % legacy user row(s). Reassign first.',
      OLD.role_name, OLD.id, active_assignments, legacy_users
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_in_use_role_deletion ON public.roles;
CREATE TRIGGER prevent_in_use_role_deletion
  BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_in_use_role_deletion();
