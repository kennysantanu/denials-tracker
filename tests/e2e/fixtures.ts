import { test as base, expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { Database } from '../../src/lib/supabase';

export type Persona = 'admin' | 'editor' | 'reader' | 'denied';
export interface SeedManifest {
	users: Record<Persona, { email: string; password: string; id: string }>;
	roleIds: number[];
}
export function manifest(): SeedManifest {
	return JSON.parse(readFileSync('.test-data/fixtures.json', 'utf8'));
}
export function credentials(persona: Persona = 'editor') {
	return manifest().users[persona];
}
export function serviceClient() {
	return createClient<Database>(
		process.env.PUBLIC_SUPABASE_URL!,
		process.env.SUPABASE_SERVICE_ROLE_KEY!,
		{
			auth: { persistSession: false, autoRefreshToken: false }
		}
	);
}
export async function userClient(persona: Persona) {
	const client = createClient<Database>(
		process.env.PUBLIC_SUPABASE_URL!,
		process.env.PUBLIC_SUPABASE_ANON_KEY!,
		{
			auth: { persistSession: false, autoRefreshToken: false }
		}
	);
	const { error } = await client.auth.signInWithPassword(credentials(persona));
	if (error) throw error;
	return client;
}
export async function signIn(page: Page, persona: Persona = 'editor') {
	await page.goto('/signin');
	const { email, password } = credentials(persona);
	await page.locator('input[name="email"]').fill(email);
	await page.locator('input[name="password"]').fill(password);
	await page.getByRole('button', { name: /sign in/i }).click();
	await expect(page).toHaveURL(/\/record$/);
}

type Fixtures = {
	dbAdmin: SupabaseClient<Database>;
	editorDb: SupabaseClient<Database>;
	readerDb: SupabaseClient<Database>;
	deniedDb: SupabaseClient<Database>;
	testPatient: Database['public']['Tables']['patients']['Row'];
};
export const test = base.extend<Fixtures>({
	dbAdmin: async ({}, use) => {
		await use(serviceClient());
	},
	editorDb: async ({}, use) => {
		await use(await userClient('editor'));
	},
	readerDb: async ({}, use) => {
		await use(await userClient('reader'));
	},
	deniedDb: async ({}, use) => {
		await use(await userClient('denied'));
	},
	testPatient: async ({ dbAdmin }, use) => {
		const { data, error } = await dbAdmin
			.from('patients')
			.insert({
				first_name: 'Synthetic',
				last_name: `Test-${randomUUID()}`,
				date_of_birth: '1990-01-01'
			})
			.select()
			.single();
		if (error) throw error;
		try {
			await use(data);
		} finally {
			const { error: cleanupError } = await dbAdmin.from('patients').delete().eq('id', data.id);
			if (cleanupError) throw cleanupError;
		}
	}
});
export { expect };
