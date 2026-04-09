-- Phase 1.9.5: Migrate v2 permission names to v3
-- Old → New: denial_edit → update_denial, denial_delete → delete_denial,
--            note_create → create_denial, attachment_add → update_denial (merged OR).
-- All other keys (generate_summary, generate_appeal, admin, audit_read, etc.) are preserved.
-- Idempotent: only roles that still carry v2 keys are updated.

UPDATE roles
SET permissions = (
  -- Strip old v2 keys
  (permissions - 'denial_edit' - 'denial_delete' - 'note_create' - 'attachment_add')
  -- Merge in v3 renamed keys
  || jsonb_build_object(
    'update_denial',
      COALESCE((permissions->>'denial_edit')::boolean,    false) OR
      COALESCE((permissions->>'attachment_add')::boolean, false),
    'delete_denial',
      COALESCE((permissions->>'denial_delete')::boolean,  false),
    'create_denial',
      COALESCE((permissions->>'note_create')::boolean,    false)
  )
)
WHERE permissions IS NOT NULL
  AND (
    permissions ? 'denial_edit'    OR
    permissions ? 'denial_delete'  OR
    permissions ? 'note_create'    OR
    permissions ? 'attachment_add'
  );
