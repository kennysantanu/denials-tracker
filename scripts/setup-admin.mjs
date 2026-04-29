#!/usr/bin/env node
// Headless first-admin bootstrap script.
//
// Usage (Node 22+):
//   node --env-file=.env scripts/setup-admin.mjs --email admin@example.com --password 'StrongPass!23'
//   npm run setup:admin -- --email admin@example.com --password 'StrongPass!23'
//
// Required env vars (loaded from .env via --env-file):
//   PUBLIC_SUPABASE_URL          (or SUPABASE_INTERNAL_URL when running inside docker)
//   SUPABASE_SERVICE_ROLE_KEY
//
// Behavior mirrors the /setup page action: refuses to run when any user
// already exists, creates an auth user with email auto-confirmed, and
// assigns the seeded "Administrator" role.

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';

const { values } = parseArgs({
	options: {
		email: { type: 'string', short: 'e' },
		password: { type: 'string', short: 'p' },
		help: { type: 'boolean', short: 'h' }
	},
	allowPositionals: false
});

if (values.help) {
	console.log(
		'Usage: node --env-file=.env scripts/setup-admin.mjs --email <email> [--password <password>]'
	);
	process.exit(0);
}

const url = process.env.SUPABASE_INTERNAL_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
	console.error(
		'[setup-admin] Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Pass --env-file=.env to node.'
	);
	process.exit(1);
}

async function prompt(question, { silent = false } = {}) {
	const rl = createInterface({ input: stdin, output: stdout, terminal: true });
	if (silent) {
		// Best-effort password masking. Node has no built-in noecho on Windows;
		// this hides characters as they are typed on TTYs that support it.
		const wasRaw = stdin.isTTY ? stdin.isRaw : false;
		stdout.write(question);
		const answer = await new Promise((resolve) => {
			let buf = '';
			const onData = (chunk) => {
				const s = chunk.toString('utf8');
				for (const ch of s) {
					if (ch === '\n' || ch === '\r') {
						stdin.removeListener('data', onData);
						stdin.setRawMode?.(wasRaw);
						stdout.write('\n');
						resolve(buf);
						return;
					}
					if (ch === '\u0003') {
						process.exit(130);
					}
					if (ch === '\u007f' || ch === '\b') {
						buf = buf.slice(0, -1);
					} else {
						buf += ch;
					}
				}
			};
			stdin.setRawMode?.(true);
			stdin.resume();
			stdin.on('data', onData);
		});
		rl.close();
		return answer;
	}
	const answer = await rl.question(question);
	rl.close();
	return answer;
}

const email = values.email ?? (await prompt('Admin email: '));
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
	console.error('[setup-admin] Invalid email.');
	process.exit(1);
}

const password = values.password ?? (await prompt('Admin password: ', { silent: true }));
if (!password || password.length < 8) {
	console.error('[setup-admin] Password must be at least 8 characters.');
	process.exit(1);
}

const supabase = createClient(url, serviceKey);

const { count, error: countError } = await supabase
	.from('users')
	.select('*', { count: 'exact', head: true });

if (countError) {
	console.error('[setup-admin] Could not query users table:', countError.message);
	process.exit(1);
}

if (count !== null && count > 0) {
	console.error(
		'[setup-admin] Refusing to run: at least one user already exists. Use the admin UI to create more users.'
	);
	process.exit(1);
}

const { data: adminRole, error: roleError } = await supabase
	.from('roles')
	.select('id')
	.eq('role_name', 'Administrator')
	.maybeSingle();

if (roleError || !adminRole) {
	console.error(
		'[setup-admin] Administrator role not found. Run database migrations first (supabase/migrate.sh).'
	);
	process.exit(1);
}

const { data: created, error: createError } = await supabase.auth.admin.createUser({
	email,
	password,
	email_confirm: true,
	user_metadata: { username: email.split('@')[0] }
});

if (createError || !created.user) {
	console.error('[setup-admin] Failed to create user:', createError?.message);
	process.exit(1);
}

const { error: assignError } = await supabase
	.from('users')
	.update({ role: adminRole.id })
	.eq('id', created.user.id);

if (assignError) {
	console.error(
		'[setup-admin] User created but role assignment failed:',
		assignError.message
	);
	await supabase.auth.admin.deleteUser(created.user.id).catch(() => {});
	process.exit(1);
}

console.log(`[setup-admin] Administrator created: ${email} (id=${created.user.id})`);
