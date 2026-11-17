import { loadTestEnv } from '../../scripts/test-backend.mjs';

/** Use the same fail-closed loader as the Docker lifecycle commands. */
export function loadTestEnvironment() {
	loadTestEnv();
	// Native preview must use the public loopback address, never Docker service DNS.
	process.env.SUPABASE_INTERNAL_URL = '';
}
