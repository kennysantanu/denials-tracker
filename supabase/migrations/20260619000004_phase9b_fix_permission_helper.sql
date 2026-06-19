-- Phase 9b hotfix: remove legacy-column reads from the RLS permission helper.
--
-- 20260619000003 drops public.users.role and public.roles.permissions, but the
-- RLS helper created in 20260521000001 still consulted those legacy columns.
-- Any policy that calls current_user_has_permission() can then fail or deny
-- unexpectedly, including patients_select, roles_select, users_select, and the
-- user_role_assignments self-read policy used by app-side authorization.
--
-- Keep the helper canonical-only from this point forward:
--   user_role_assignments -> role_permissions
--
-- Also mirror app-side authz behavior by allowing break_glass.admin to satisfy
-- any requested permission except a direct check for break_glass.admin itself.

CREATE OR REPLACE FUNCTION public.current_user_has_permission(perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.role_permissions rp ON rp.role_id = ura.role_id
    WHERE ura.user_id = auth.uid()
      AND ura.revoked_at IS NULL
      AND (
        rp.permission_key = perm_key
        OR (
          perm_key <> 'break_glass.admin'
          AND rp.permission_key = 'break_glass.admin'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_has_permission(text) FROM public;
GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;
