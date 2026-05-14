-- system_preferences.read and system_preferences.update were introduced in
-- 20260515000001_create_permission_catalog.sql without legacy_keys and without
-- any entries in permission_compatibility_map.  This means the dual-mode
-- authorize() engine finds no grant for admin users on either path:
--
--   legacy path : roles.permissions JSON has no 'system_preferences.*' key,
--                 and the compat map has nothing bridging admin legacy keys →
--                 system_preferences.*  → legacyAllowed = false
--
--   new path    : role_permissions was never seeded for the Administrator
--                 role → newAllowed = false
--
-- Fix:
--   1. Add compat-map entries so the existing legacy 'admin' key covers both
--      permissions (dual / legacy engine modes).
--   2. Seed role_permissions for Administrator (new / dual engine modes).

-- ---------------------------------------------------------------------------
-- 1. Compatibility-map entries (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_compatibility_map (legacy_key, permission_key, direction, notes)
VALUES
  ('admin', 'system_preferences.read',   'legacy_to_new', 'system_preferences.read has no legacy key; bridge via break-glass admin key'),
  ('admin', 'system_preferences.update', 'legacy_to_new', 'system_preferences.update has no legacy key; bridge via break-glass admin key')
ON CONFLICT (legacy_key, permission_key, direction) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. role_permissions seed for Administrator (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, perms.key
FROM public.roles r
CROSS JOIN (VALUES
  ('system_preferences.read'),
  ('system_preferences.update')
) AS perms(key)
WHERE r.role_name = 'Administrator'
ON CONFLICT DO NOTHING;
