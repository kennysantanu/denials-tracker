-- Phase 1 supplement: add v2-era legacy key mappings to compatibility map
--
-- Migration 20260410000001 was intended to strip these old v2 keys, but some
-- roles in the database still carry them. The backfill script (Phase 2)
-- cannot resolve them without mappings here, so we add conservative
-- legacy_to_new entries that mirror the semantics of the v3 equivalents.
--
-- These keys are considered read-only legacy aliases - they will never be
-- written again by the app, but they must resolve correctly during the
-- dual-read transition window.

INSERT INTO public.permission_compatibility_map (legacy_key, permission_key, direction, notes) VALUES
  -- v2: denial_read  -> same as v3 view_denials
  ('denial_read',        'denial.read',          'legacy_to_new', 'v2 key, superseded by view_denials in v3'),

  -- v2: admin_read   -> break_glass only (same rule as legacy admin)
  ('admin_read',         'break_glass.admin',    'legacy_to_new', 'v2 key, superseded by admin in v3'),

  -- v2: denial_edit  -> update + close + reopen + note.update + followup
  ('denial_edit',        'denial.update',        'legacy_to_new', 'v2 key, superseded by update_denial in v3'),
  ('denial_edit',        'denial.close',         'legacy_to_new', 'v2 key'),
  ('denial_edit',        'denial.reopen',        'legacy_to_new', 'v2 key'),
  ('denial_edit',        'note.update',          'legacy_to_new', 'v2 key'),
  ('denial_edit',        'followup.update',      'legacy_to_new', 'v2 key'),

  -- v2: denial_create -> denial.create + note.create
  ('denial_create',      'denial.create',        'legacy_to_new', 'v2 key, superseded by create_denial in v3'),
  ('denial_create',      'note.create',          'legacy_to_new', 'v2 key'),

  -- v2: denial_delete -> denial.delete + note.delete
  ('denial_delete',      'denial.delete',        'legacy_to_new', 'v2 key, superseded by delete_denial in v3'),
  ('denial_delete',      'note.delete',          'legacy_to_new', 'v2 key'),

  -- v2: note_create, note_edit, note_delete
  ('note_create',        'note.create',          'legacy_to_new', 'v2 key'),
  ('note_edit',          'note.update',          'legacy_to_new', 'v2 key'),
  ('note_delete',        'note.delete',          'legacy_to_new', 'v2 key'),

  -- v2: attachment_add, attachment_remove
  ('attachment_add',     'file.upload',          'legacy_to_new', 'v2 key, superseded by file_upload in v3'),
  ('attachment_remove',  'file.delete',          'legacy_to_new', 'v2 key, superseded by file_delete in v3'),

  -- v2: file_read
  ('file_read',          'file.read',            'legacy_to_new', 'v2 key')

ON CONFLICT (legacy_key, permission_key, direction) DO NOTHING;
