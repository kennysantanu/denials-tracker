-- Phase 6 fix: make replace_role_permissions SECURITY DEFINER so it can
-- mutate role_permissions regardless of the caller's RLS context.
--
-- Background: role_permissions has only a SELECT policy for authenticated
-- users (no INSERT/DELETE). The function was created without SECURITY DEFINER
-- pending a Phase 6 admin-only RLS pass that was never added, causing the
-- "new row violates row-level security" error when the admin UI saves a role.
--
-- The function is already guarded at the application layer by requirePermission
-- checks (role.create / role.update) before the RPC is ever invoked, so
-- bypassing RLS inside the function is safe.

CREATE OR REPLACE FUNCTION public.replace_role_permissions(
  p_role_id        bigint,
  p_keys           text[],
  p_actor_user_id  uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  -- Wipe any existing grants for this role.
  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  -- Insert the new set, dedup'd. Empty array is a valid input (= revoke all).
  IF p_keys IS NOT NULL AND array_length(p_keys, 1) > 0 THEN
    INSERT INTO public.role_permissions (role_id, permission_key, created_by)
    SELECT p_role_id, k, p_actor_user_id
    FROM unnest(p_keys) AS k
    ON CONFLICT (role_id, permission_key) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END IF;

  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_role_permissions(bigint, text[], uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_role_permissions(bigint, text[], uuid) TO authenticated, service_role;
