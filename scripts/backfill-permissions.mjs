#!/usr/bin/env node
// Phase 2 - Backfill role_permissions + user_role_assignments
//
// For each role: reads legacy `roles.permissions` JSON, expands every truthy
// key through `permission_compatibility_map` (legacy_to_new + both), inserts
// the resulting canonical keys into `role_permissions`.
//
// For each user: reads the current `users.role` FK and inserts one active
// `user_role_assignments` row (single-role per the overhaul scope decision).
//
// Safe to re-run - all inserts use ON CONFLICT DO NOTHING.
//
// Usage:
//   node --env-file=.env scripts/backfill-permissions.mjs
//   node --env-file=.env scripts/backfill-permissions.mjs --dry-run

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
	options: {
		'dry-run': { type: 'boolean', default: false },
		help: { type: 'boolean', short: 'h' }
	}
});

if (values.help) {
	console.log('Usage: node --env-file=.env scripts/backfill-permissions.mjs [--dry-run]');
	process.exit(0);
}

const DRY_RUN = values['dry-run'];

const url = process.env.SUPABASE_INTERNAL_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
	console.error(
		'[backfill] Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Pass --env-file=.env to node.'
	);
	process.exit(1);
}

const supabase = createClient(url, serviceKey);

// ---------------------------------------------------------------------------
// 1. Load the full compatibility map (legacy_to_new + both)
// ---------------------------------------------------------------------------
const { data: compMap, error: compError } = await supabase
	.from('permission_compatibility_map')
	.select('legacy_key, permission_key, direction')
	.in('direction', ['legacy_to_new', 'both'])
	.eq('is_active', true);

if (compError) {
	console.error('[backfill] Failed to load compatibility map:', compError.message);
	process.exit(1);
}

/** @type {Map<string, string[]>} legacy_key -> canonical_key[] */
const legacyToCanonical = new Map();
for (const row of compMap) {
	if (!legacyToCanonical.has(row.legacy_key)) legacyToCanonical.set(row.legacy_key, []);
	legacyToCanonical.get(row.legacy_key).push(row.permission_key);
}

console.log(
	`[backfill] Compatibility map loaded: ${compMap.length} mappings, ${legacyToCanonical.size} distinct legacy keys`
);

// ---------------------------------------------------------------------------
// 2. Backfill role_permissions
// ---------------------------------------------------------------------------
const { data: roles, error: rolesError } = await supabase
	.from('roles')
	.select('id, role_name, permissions')
	.order('id');

if (rolesError) {
	console.error('[backfill] Failed to load roles:', rolesError.message);
	process.exit(1);
}

let roleGrantsInserted = 0;
let roleGrantsSkipped = 0;

for (const role of roles) {
	if (!role.permissions || typeof role.permissions !== 'object') {
		console.log(`  [role ${role.id} "${role.role_name}"] no permissions JSON, skipping`);
		continue;
	}

	const truthy = Object.entries(role.permissions)
		.filter(([, v]) => v === true)
		.map(([k]) => k);

	const canonicalKeys = new Set();
	for (const legacyKey of truthy) {
		const mapped = legacyToCanonical.get(legacyKey) ?? [];
		if (mapped.length === 0) {
			console.warn(
				`  [role ${role.id} "${role.role_name}"] legacy key "${legacyKey}" has no canonical mapping - skipping`
			);
		}
		for (const k of mapped) canonicalKeys.add(k);
	}

	const rows = [...canonicalKeys].map((permission_key) => ({
		role_id: role.id,
		permission_key
	}));

	if (rows.length === 0) {
		console.log(`  [role ${role.id} "${role.role_name}"] 0 canonical grants derived`);
		continue;
	}

	console.log(
		`  [role ${role.id} "${role.role_name}"] ${rows.length} canonical grants from ${truthy.length} legacy keys`
	);

	if (!DRY_RUN) {
		const { error } = await supabase
			.from('role_permissions')
			.upsert(rows, { onConflict: 'role_id,permission_key', ignoreDuplicates: true });

		if (error) {
			console.error(`  [role ${role.id}] insert failed:`, error.message);
			process.exit(1);
		}
		roleGrantsInserted += rows.length;
	} else {
		roleGrantsInserted += rows.length;
	}
}

console.log(
	`[backfill] role_permissions: ${roleGrantsInserted} rows upserted (dry-run=${DRY_RUN})`
);

// ---------------------------------------------------------------------------
// 3. Backfill user_role_assignments
// ---------------------------------------------------------------------------
const { data: users, error: usersError } = await supabase
	.from('users')
	.select('id, role, username')
	.not('role', 'is', null)
	.order('created_at');

if (usersError) {
	console.error('[backfill] Failed to load users:', usersError.message);
	process.exit(1);
}

// Load existing active assignments to skip users already backfilled.
const { data: existingAssignments, error: existingError } = await supabase
	.from('user_role_assignments')
	.select('user_id')
	.is('revoked_at', null);

if (existingError) {
	console.error('[backfill] Failed to load existing assignments:', existingError.message);
	process.exit(1);
}

const alreadyAssigned = new Set(existingAssignments.map((r) => r.user_id));

const assignmentRows = users
	.filter((u) => !alreadyAssigned.has(u.id))
	.map((u) => ({
		user_id: u.id,
		role_id: u.role,
		reason: 'backfill from users.role (phase 2)'
	}));

if (assignmentRows.length === 0) {
	console.log(
		'[backfill] user_role_assignments: all users already have active assignments, nothing to insert'
	);
} else {
	console.log(
		`[backfill] user_role_assignments: inserting ${assignmentRows.length} rows (${users.length - assignmentRows.length} already had active assignments)`
	);

	if (!DRY_RUN) {
		const { error } = await supabase.from('user_role_assignments').insert(assignmentRows);

		if (error) {
			console.error('[backfill] user_role_assignments insert failed:', error.message);
			process.exit(1);
		}
	}
}

if (DRY_RUN) {
	console.log('[backfill] DRY RUN complete - no changes written to the database.');
} else {
	console.log('[backfill] Done.');
}
