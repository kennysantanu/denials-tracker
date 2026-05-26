-- Phase 6: Tighten RLS on all business tables
--
-- Replaces the blanket "Enable all access for authenticated users" (using(true))
-- policies on every core business table with canonical-permission-aware policies.
--
-- Strategy
-- --------
-- 1. Define `public.current_user_has_permission(perm_key text)` — a STABLE,
--    SECURITY DEFINER helper that checks BOTH the new role_permissions path AND
--    the legacy roles.permissions JSON path (via compatibility map) so that
--    dual-mode continues to work during the Phase 3→8 window.
--
-- 2. Drop each permissive "using (true)" policy and replace with split
--    SELECT / INSERT / UPDATE / DELETE policies per table.
--
-- 3. Tables already hardened in earlier migrations are NOT touched:
--      preferences, preference_users  (20260516000005)
--      permission_catalog, role_permissions, user_role_assignments,
--      permission_compatibility_map, app_events  (Phase 1 migrations)
--      audit_log insert policy  (20260409000002 — kept, only SELECT is replaced)
--      ai_interactions, conversations  (20260409000004/5 — kept, only admin
--          SELECT on ai_interactions is upgraded from legacy key check)
--
-- 4. roles: keeps the existing anon "Enable insert for initial setup" policy.
--
-- 5. users: self-read/update is always allowed (profile / account-settings page).
--
-- 6. storage.objects: scoped to bucket_id = 'files'.
--    storage.buckets: drop broad write; allow authenticated SELECT only.
-- =============================================================================


-- =============================================================================
-- HELPER: current_user_has_permission
-- Dual-mode: new role_permissions table OR legacy roles.permissions JSON,
-- with compatibility-map resolution for canonical-key lookup against legacy JSON.
-- SECURITY DEFINER + locked search_path prevents privilege escalation.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_user_has_permission(perm_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    -- New path: user_role_assignments → role_permissions
    EXISTS (
      SELECT 1
      FROM public.user_role_assignments ura
      JOIN public.role_permissions rp ON rp.role_id = ura.role_id
      WHERE ura.user_id = auth.uid()
        AND ura.revoked_at IS NULL
        AND rp.permission_key = perm_key
    )
    OR
    -- Legacy path: users.role → roles.permissions JSON (verbatim key match)
    EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role
      WHERE u.id = auth.uid()
        AND r.permissions ->> perm_key = 'true'
    )
    OR
    -- Legacy path via compatibility map:
    --   legacy key in roles.permissions → canonical perm_key
    EXISTS (
      SELECT 1
      FROM public.users u
      JOIN public.roles r ON r.id = u.role
      JOIN public.permission_compatibility_map pcm
        ON r.permissions ->> pcm.legacy_key = 'true'
      WHERE u.id = auth.uid()
        AND pcm.permission_key = perm_key
        AND pcm.is_active = true
        AND pcm.direction IN ('legacy_to_new', 'both')
    );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_permission(text) TO authenticated;


-- =============================================================================
-- PATIENTS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.patients;

CREATE POLICY "patients_select"
  ON public.patients AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('patient.read'));

CREATE POLICY "patients_insert"
  ON public.patients AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('patient.create'));

CREATE POLICY "patients_update"
  ON public.patients AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('patient.update'))
  WITH CHECK (current_user_has_permission('patient.update'));

CREATE POLICY "patients_delete"
  ON public.patients AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('patient.archive'));


-- =============================================================================
-- DENIALS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.denials;

CREATE POLICY "denials_select"
  ON public.denials AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('denial.read'));

CREATE POLICY "denials_insert"
  ON public.denials AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('denial.create'));

CREATE POLICY "denials_update"
  ON public.denials AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('denial.update'))
  WITH CHECK (current_user_has_permission('denial.update'));

CREATE POLICY "denials_delete"
  ON public.denials AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('denial.delete'));


-- =============================================================================
-- NOTES
-- Notes are always accessed in the context of a denial, so SELECT is gated
-- on denial.read rather than a separate note.read key.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.notes;

CREATE POLICY "notes_select"
  ON public.notes AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('denial.read'));

CREATE POLICY "notes_insert"
  ON public.notes AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('note.create'));

CREATE POLICY "notes_update"
  ON public.notes AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('note.update'))
  WITH CHECK (current_user_has_permission('note.update'));

CREATE POLICY "notes_delete"
  ON public.notes AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('note.delete'));


-- =============================================================================
-- NOTES_FILES  (junction: notes ↔ storage file names)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.notes_files;

CREATE POLICY "notes_files_select"
  ON public.notes_files AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('denial.read'));

-- Attaching a file to a note is a note-create/update action.
CREATE POLICY "notes_files_insert"
  ON public.notes_files AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    current_user_has_permission('note.create')
    OR current_user_has_permission('note.update')
  );

CREATE POLICY "notes_files_delete"
  ON public.notes_files AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('note.delete'));


-- =============================================================================
-- FILES  (public.files — storage metadata: name, size, mimetype, metadata)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.files;

CREATE POLICY "files_select"
  ON public.files AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('file.read'));

CREATE POLICY "files_insert"
  ON public.files AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('file.upload'));

CREATE POLICY "files_update"
  ON public.files AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('file.update'))
  WITH CHECK (current_user_has_permission('file.update'));

CREATE POLICY "files_delete"
  ON public.files AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('file.delete'));


-- =============================================================================
-- PATIENTS_FILES  (per-patient file metadata)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.patients_files;

CREATE POLICY "patients_files_select"
  ON public.patients_files AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('file.read'));

CREATE POLICY "patients_files_insert"
  ON public.patients_files AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('file.upload'));

CREATE POLICY "patients_files_update"
  ON public.patients_files AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('file.update'))
  WITH CHECK (current_user_has_permission('file.update'));

CREATE POLICY "patients_files_delete"
  ON public.patients_files AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('file.delete'));


-- =============================================================================
-- LABELS
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.labels;

CREATE POLICY "labels_select"
  ON public.labels AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('label.read'));

CREATE POLICY "labels_insert"
  ON public.labels AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('label.create'));

CREATE POLICY "labels_update"
  ON public.labels AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('label.update'))
  WITH CHECK (current_user_has_permission('label.update'));

CREATE POLICY "labels_delete"
  ON public.labels AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('label.delete'));


-- =============================================================================
-- DENIALS_LABELS  (junction: denials ↔ labels)
-- Adding/removing a label from a denial is a denial-update action.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.denials_labels;

CREATE POLICY "denials_labels_select"
  ON public.denials_labels AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('denial.read'));

CREATE POLICY "denials_labels_insert"
  ON public.denials_labels AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('denial.update'));

CREATE POLICY "denials_labels_delete"
  ON public.denials_labels AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('denial.update'));


-- =============================================================================
-- INSURANCES
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.insurances;

CREATE POLICY "insurances_select"
  ON public.insurances AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('insurance.read'));

CREATE POLICY "insurances_insert"
  ON public.insurances AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('insurance.create'));

CREATE POLICY "insurances_update"
  ON public.insurances AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('insurance.update'))
  WITH CHECK (current_user_has_permission('insurance.update'));

CREATE POLICY "insurances_delete"
  ON public.insurances AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('insurance.delete'));


-- =============================================================================
-- DENIALS_INSURANCES  (junction: denials ↔ insurances)
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.denials_insurances;

CREATE POLICY "denials_insurances_select"
  ON public.denials_insurances AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('denial.read'));

CREATE POLICY "denials_insurances_insert"
  ON public.denials_insurances AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('denial.update'));

CREATE POLICY "denials_insurances_delete"
  ON public.denials_insurances AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('denial.update'));


-- =============================================================================
-- ROLES
-- Any authenticated user may read the role row they are assigned to
-- (needed by layout.server.ts: `users.select('*, roles!fkey(*)')`).
-- Full CRUD requires role.* permissions.
-- The existing anon "Enable insert for initial setup" policy is preserved.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.roles;

CREATE POLICY "roles_select"
  ON public.roles AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    current_user_has_permission('role.read')
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = roles.id
    )
  );

CREATE POLICY "roles_insert"
  ON public.roles AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('role.create'));

CREATE POLICY "roles_update"
  ON public.roles AS PERMISSIVE FOR UPDATE TO authenticated
  USING  (current_user_has_permission('role.update'))
  WITH CHECK (current_user_has_permission('role.update'));

CREATE POLICY "roles_delete"
  ON public.roles AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('role.delete'));


-- =============================================================================
-- USERS
-- Self-read and self-update are always allowed so that the layout fetch and
-- account-settings page work without requiring user.read / user.update.
-- Admin operations require the corresponding user.* permission.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.users;

CREATE POLICY "users_select"
  ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR current_user_has_permission('user.read')
  );

CREATE POLICY "users_insert"
  ON public.users AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (current_user_has_permission('user.create'));

CREATE POLICY "users_update"
  ON public.users AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR current_user_has_permission('user.update')
  )
  WITH CHECK (
    id = auth.uid()
    OR current_user_has_permission('user.update')
  );

CREATE POLICY "users_delete"
  ON public.users AS PERMISSIVE FOR DELETE TO authenticated
  USING (current_user_has_permission('user.delete'));


-- =============================================================================
-- AUDIT LOG — upgrade admin-read policy from legacy key to canonical key
-- The insert policy ("Enable insert for authenticated users") is unchanged.
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for admin users" ON public.audit_log;

CREATE POLICY "audit_log_select"
  ON public.audit_log AS PERMISSIVE FOR SELECT TO authenticated
  USING (current_user_has_permission('audit.read'));


-- =============================================================================
-- AI_INTERACTIONS — upgrade admin-read policy from legacy `admin` key to
-- canonical `audit.read`.  Users may always read their own rows.
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for own rows or admin" ON public.ai_interactions;

CREATE POLICY "ai_interactions_select"
  ON public.ai_interactions AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR current_user_has_permission('audit.read')
  );


-- =============================================================================
-- STORAGE.OBJECTS  (files bucket — PHI attachments)
-- Scoped to bucket_id = 'files'.  Other buckets (if any added later) must
-- define their own policies.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage.objects;

CREATE POLICY "storage_objects_select"
  ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'files'
    AND current_user_has_permission('file.read')
  );

CREATE POLICY "storage_objects_insert"
  ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'files'
    AND current_user_has_permission('file.upload')
  );

CREATE POLICY "storage_objects_update"
  ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    bucket_id = 'files'
    AND current_user_has_permission('file.update')
  )
  WITH CHECK (
    bucket_id = 'files'
    AND current_user_has_permission('file.update')
  );

CREATE POLICY "storage_objects_delete"
  ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'files'
    AND current_user_has_permission('file.delete')
  );


-- =============================================================================
-- STORAGE.BUCKETS — remove broad write access; authenticated SELECT only
-- Bucket management is infrastructure-level; service_role (which bypasses RLS)
-- is the only actor that needs to create/update/delete bucket definitions.
-- =============================================================================
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON storage.buckets;

CREATE POLICY "storage_buckets_select"
  ON storage.buckets AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);
