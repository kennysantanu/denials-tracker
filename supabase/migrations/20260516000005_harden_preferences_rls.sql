-- Harden RLS on preferences tables.
--
-- Original policies (20250422201853_create_table_preferences.sql) used
--   FOR ALL TO authenticated USING (true)
-- which let any signed-in user:
--   * read/write every other user's preference_users overrides
--   * directly INSERT/UPDATE/DELETE rows in the system-level preferences table
--     bypassing server actions and audit logging
--
-- This migration replaces those policies with least-privilege rules:
--   * preferences: read for any authenticated user, writes only for service_role
--   * preference_users: each user may read/write only their own row

-- ---------------------------------------------------------------------------
-- preferences (system-level)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for authenticated users"
  ON public.preferences;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preferences'
      AND policyname = 'preferences_read_authenticated'
  ) THEN
    CREATE POLICY "preferences_read_authenticated"
      ON public.preferences
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- No INSERT / UPDATE / DELETE policies for authenticated.
-- service_role bypasses RLS, so server-side admin actions still work.

-- ---------------------------------------------------------------------------
-- preference_users (per-user overrides)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Enable read access for authenticated users"
  ON public.preference_users;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preference_users'
      AND policyname = 'preference_users_select_own'
  ) THEN
    CREATE POLICY "preference_users_select_own"
      ON public.preference_users
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preference_users'
      AND policyname = 'preference_users_insert_own'
  ) THEN
    CREATE POLICY "preference_users_insert_own"
      ON public.preference_users
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preference_users'
      AND policyname = 'preference_users_update_own'
  ) THEN
    CREATE POLICY "preference_users_update_own"
      ON public.preference_users
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'preference_users'
      AND policyname = 'preference_users_delete_own'
  ) THEN
    CREATE POLICY "preference_users_delete_own"
      ON public.preference_users
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
