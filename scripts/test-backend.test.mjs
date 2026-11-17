import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';

const secret = 'a'.repeat(64);
function token(role) {
	const body = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ role, exp: 4102444800 })).toString('base64url')}`;
	return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
const valid = {
	TEST_BACKEND: 'local',
	ORIGIN: 'http://127.0.0.1:4173',
	PUBLIC_SUPABASE_URL: 'http://127.0.0.1:58000',
	SUPABASE_INTERNAL_URL: 'http://127.0.0.1:58000',
	DATABASE_URL: `postgres://postgres:${secret}@127.0.0.1:55432/postgres`,
	POSTGRES_PASSWORD: secret,
	JWT_SECRET: secret,
	PUBLIC_SUPABASE_ANON_KEY: token('anon'),
	SUPABASE_SERVICE_ROLE_KEY: token('service_role'),
	DASHBOARD_PASSWORD: secret,
	PG_META_CRYPTO_KEY: secret
};
test('loader fails closed and overrides ambient deployment environment', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'denials-test-loader-'));
	mkdirSync(join(dir, 'scripts'));
	copyFileSync(
		new URL('./test-backend.mjs', import.meta.url),
		join(dir, 'scripts/test-backend.mjs')
	);
	const { loadTestEnv, appTestEnv } = await import(join(dir, 'scripts/test-backend.mjs'));
	const previous = { ...process.env };
	const write = (env, marker = '# denials-tracker disposable test backend v1') =>
		writeFileSync(
			join(dir, '.env.test.local'),
			`${marker}\n${Object.entries(env)
				.map(([k, v]) => `${k}=${v}`)
				.join('\n')}\n`
		);
	try {
		assert.throws(() => loadTestEnv(), /not configured/);
		write(valid, '# hand-created');
		assert.throws(() => loadTestEnv(), /unmarked/);
		for (const change of [
			{ TEST_BACKEND: 'production' },
			{ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' },
			{ SUPABASE_INTERNAL_URL: 'http://kong:8000' },
			{ DATABASE_URL: `postgres://postgres:${secret}@127.0.0.1:5432/postgres` },
			{ SUPABASE_SERVICE_ROLE_KEY: token('anon') }
		]) {
			write({ ...valid, ...change });
			assert.throws(() => loadTestEnv());
		}
		write(valid);
		process.env.PUBLIC_SUPABASE_URL = 'https://production.example';
		process.env.SUPABASE_INTERNAL_URL = 'http://production:8000';
		process.env.MAX_LOGIN_ATTEMPTS = '1';
		process.env.WIKI_PATH = '/developer/wiki';
		assert.deepEqual(loadTestEnv(), { ...valid, ...appTestEnv });
		for (const [key, value] of Object.entries(appTestEnv)) assert.equal(process.env[key], value);
		assert.equal(process.env.PUBLIC_SUPABASE_URL, valid.PUBLIC_SUPABASE_URL);
		assert.equal(process.env.SUPABASE_INTERNAL_URL, valid.SUPABASE_INTERNAL_URL);
	} finally {
		for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
		Object.assign(process.env, previous);
		rmSync(dir, { recursive: true, force: true });
	}
});
