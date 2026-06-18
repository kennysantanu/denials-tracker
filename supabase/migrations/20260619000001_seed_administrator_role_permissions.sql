-- Seed ALL active canonical permission keys for the Administrator role.
--
-- Prior migrations only partially seeded role_permissions (system_preferences.*
-- was added in 20260516000003). This migration fills the gap idempotently so
-- a fresh install (or an existing one that ran migrations in order) ends up
-- with a fully-capable Administrator role in the canonical store.
--
-- The setup action (/setup) and the admin user-create action both use
-- `setUserActiveRole()` to insert a `user_role_assignments` row. Since
-- `authorize()` reads user_role_assignments → role_permissions (canonical
-- only, post Phase 9a), the Administrator role must have every active key in
-- role_permissions or the first admin will be locked out.

INSERT INTO public.role_permissions (role_id, permission_key)
SELECT r.id, c.key
FROM public.roles r
CROSS JOIN public.permission_catalog c
WHERE r.role_name = 'Administrator'
  AND c.is_active = true
  AND c.deprecated_at IS NULL
ON CONFLICT DO NOTHING;
