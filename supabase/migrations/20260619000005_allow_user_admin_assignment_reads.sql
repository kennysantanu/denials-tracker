-- Phase 9b hotfix: allow Users admin readers to see role assignments.
--
-- The Settings > Admin > Users page is gated by user.read and embeds each
-- user's active role assignment:
--   users -> user_role_assignments -> roles
--
-- After the legacy users.role column was dropped, user_role_assignments became
-- the only source for role display/editing on that page. The existing policy
-- allowed self-read or audit.read, which made the users table fragile for
-- operators who can manage users but are not audit administrators.

DROP POLICY IF EXISTS "user_role_assignments_read_self_or_audit" ON public.user_role_assignments;

CREATE POLICY "user_role_assignments_read_self_or_audit"
  ON public.user_role_assignments AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR current_user_has_permission('audit.read')
    OR current_user_has_permission('user.read')
  );
