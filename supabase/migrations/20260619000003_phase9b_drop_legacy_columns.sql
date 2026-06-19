-- Phase 9b: Drop legacy permission columns
--
-- Prerequisites (verify before applying):
--   1. Application code no longer reads or writes `users.role` or
--      `roles.permissions` — confirmed in Phase 9a/9b code changes.
--   2. All `permission_compatibility_map` rows have is_active = false
--      (applied in migration 20260616000001).
--   3. Pre-flight SQL checks pass (see PERMISSION_OVERHAUL_PLAN.md).
--
-- This migration is intentionally non-destructive first:
--   Step 1 — archive `roles.permissions` data before dropping.
--   Step 2 — update the role-deletion guard trigger (references `users.role`).
--   Step 3 — rewrite RLS policies that reference `roles.permissions` (audit_read).
--   Step 4 — drop `roles.permissions` (column + its constraint).
--   Step 5 — fix `roles_select` RLS policy (references `users.role`).
--   Step 6 — drop `users.role` FK column.
--   Step 7 — drop `permission_compatibility_map` table (legacy bridge, all
--             rows already deactivated; kept as archive by default — uncomment
--             the DROP if you want to remove the table entirely).
-- =============================================================================

-- 1. Archive roles.permissions before dropping
--    Safe to run multiple times (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS public.roles_legacy_permissions_archive AS
SELECT
  id          AS role_id,
  role_name,
  permissions AS legacy_permissions_json,
  now()       AS archived_at
FROM public.roles
WHERE permissions IS NOT NULL AND permissions <> '{}'::jsonb;

-- 2. Update the role-deletion guard trigger so it no longer references
--    users.role (which is about to be dropped).
CREATE OR REPLACE FUNCTION public.prevent_in_use_role_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  active_assignments integer;
BEGIN
  SELECT count(*) INTO active_assignments
    FROM public.user_role_assignments
   WHERE role_id = OLD.id
     AND revoked_at IS NULL;

  IF active_assignments > 0 THEN
    RAISE EXCEPTION
      'Cannot delete role % (id=%): still assigned to % active user(s). Revoke first.',
      OLD.role_name, OLD.id, active_assignments
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN OLD;
END;
$$;

-- 3. Rewrite RLS policies that reference roles.permissions->>'audit_read'.
--    These two policies were created before the canonical permission engine
--    existed. Replace the legacy JSONB read with current_user_has_permission().

DROP POLICY IF EXISTS "user_role_assignments_read_self_or_audit" ON public.user_role_assignments;
CREATE POLICY "user_role_assignments_read_self_or_audit"
  ON public.user_role_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR current_user_has_permission('audit.read')
  );

DROP POLICY IF EXISTS "app_events_read_self_or_audit" ON public.app_events;
CREATE POLICY "app_events_read_self_or_audit"
  ON public.app_events AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    actor_user_id = auth.uid()
    OR current_user_has_permission('audit.read')
  );

-- 4. Drop roles.permissions
--    Drop the check constraint first (added in harden_roles_users migration).
ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_permissions_object_check;

ALTER TABLE public.roles
  DROP COLUMN IF EXISTS permissions;

-- 5. Fix roles_select RLS policy — drop the users.role-based OR branch.
--    Replace it with a user_role_assignments lookup so any authenticated user
--    can still read the role row they are actively assigned to.
DROP POLICY IF EXISTS "roles_select" ON public.roles;

CREATE POLICY "roles_select"
  ON public.roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    current_user_has_permission('role.read')
    OR EXISTS (
      SELECT 1 FROM public.user_role_assignments ura
      WHERE ura.user_id = auth.uid()
        AND ura.role_id = roles.id
        AND ura.revoked_at IS NULL
    )
  );

-- 6. Drop users.role FK column
--    PostgreSQL automatically drops the FK constraint when the column is dropped.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS role;

-- 7. Deactivate / drop permission_compatibility_map
--    All rows were already set to is_active = false in Phase 9a.
--    The table is kept here as a permanent audit record.
--    Uncomment the line below only if you want to fully remove it:
-- DROP TABLE IF EXISTS public.permission_compatibility_map;
