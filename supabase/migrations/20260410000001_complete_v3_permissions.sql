-- Complete v2 → v3 permission key migration
-- The previous migration (003) handled denial_edit, denial_delete, note_create, attachment_add.
-- This migration handles the remaining v2 keys that the v3 code expects.
--
-- V2 DB keys        → V3 code keys
-- ─────────────────────────────────────
-- denial_read       → view_denials
-- admin_read        → admin
-- (new)             → view_reports      (grant to roles that had admin_read or denial_read)
-- (new)             → export_reports    (grant to roles that had admin_read)
-- (new)             → manage_patients   (grant to roles that had admin_read)
-- (new)             → manage_insurances (grant to roles that had admin_read)
-- (new)             → audit_read        (grant to roles that had admin_read)
-- (new)             → manage_users      (grant to roles that had admin_read)
-- (new)             → manage_roles      (grant to roles that had admin_read)
-- (new)             → manage_labels     (grant to roles that had admin_read)
--
-- Also cleans up leftover v2-only keys: file_edit, file_read, note_edit,
-- file_delete, file_upload, note_delete, attachment_remove, denial_create (duplicate).
-- Idempotent: only rows still carrying v2 keys are updated.

UPDATE roles
SET permissions = (
  -- Start with current permissions, strip all v2-only keys
  (permissions
    - 'denial_read'
    - 'admin_read'
    - 'file_edit'
    - 'file_read'
    - 'note_edit'
    - 'file_delete'
    - 'file_upload'
    - 'note_delete'
    - 'attachment_remove'
    - 'denial_create'
  )
  -- Merge in v3 keys derived from v2 values
  || jsonb_build_object(
    'view_denials',
      COALESCE((permissions->>'denial_read')::boolean, false),
    'admin',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'view_reports',
      COALESCE((permissions->>'admin_read')::boolean, false)
        OR COALESCE((permissions->>'denial_read')::boolean, false),
    'export_reports',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'manage_patients',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'manage_insurances',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'audit_read',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'manage_users',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'manage_roles',
      COALESCE((permissions->>'admin_read')::boolean, false),
    'manage_labels',
      COALESCE((permissions->>'admin_read')::boolean, false)
  )
)
WHERE permissions IS NOT NULL
  AND (
    permissions ? 'denial_read'  OR
    permissions ? 'admin_read'   OR
    permissions ? 'file_edit'    OR
    permissions ? 'file_read'    OR
    permissions ? 'note_edit'    OR
    permissions ? 'file_delete'  OR
    permissions ? 'file_upload'  OR
    permissions ? 'note_delete'  OR
    permissions ? 'attachment_remove' OR
    permissions ? 'denial_create'
  );
