-- Phase 9a: deprecate legacy compatibility keys
--
-- Marks all rows in `permission_compatibility_map` as inactive (legacy paths
-- are no longer consulted by `authorize()` or `loadEffectivePermissions()`).
--
-- Also adds a `deprecated_at` column to `permission_catalog` and soft-marks
-- any catalog key that only ever existed as a legacy compatibility alias.
-- (None of the canonical keys seeded in Phase 1 are deprecated — this column
-- is reserved for future use and to satisfy `getPermissionCatalog`'s filter.)
--
-- NOTE: `roles.permissions` column and `users.role` FK are intentionally left
-- intact. They will be archived and dropped in Phase 9b once we confirm
-- nothing reads them at runtime.
-- =============================================================================

-- 1. Deactivate all compatibility map rows.
--    The authorize() function no longer queries this table, but we keep rows
--    for historical FK integrity on app_events.permission_key references.
UPDATE public.permission_compatibility_map
SET is_active = false
WHERE is_active = true;

-- 2. Add deprecated_at to permission_catalog (idempotent).
ALTER TABLE public.permission_catalog
  ADD COLUMN IF NOT EXISTS deprecated_at timestamptz;

-- 3. No canonical keys from the Phase 1 seed need deprecating at this point.
--    The column exists so getPermissionCatalog() can filter on it in future.
--    If you need to retire a canonical key later:
--
--    UPDATE public.permission_catalog
--    SET deprecated_at = now()
--    WHERE key = 'some.old.key';
