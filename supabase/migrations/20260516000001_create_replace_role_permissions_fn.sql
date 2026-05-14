-- Phase 4 - Atomic role-permission replacement.
--
-- Used by the admin "edit role" flow: clears all existing rows for the role
-- and re-inserts the supplied canonical keys in a single statement. Returns
-- the count of rows inserted.
--
-- Validates every key against permission_catalog (via FK on role_permissions),
-- so unknown keys cause the function to abort with a foreign_key_violation.
--
-- SECURITY DEFINER is intentionally NOT used - the caller's RLS context
-- applies. Admin-only RLS on role_permissions is layered in Phase 6.

CREATE OR REPLACE FUNCTION public.replace_role_permissions(
  p_role_id      bigint,
  p_keys         text[],
  p_actor_user_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
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
