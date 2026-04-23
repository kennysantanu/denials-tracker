/**
 * Module-level cache for AI availability so multiple NoteEditor instances
 * on the same page share a single fetch instead of making N requests.
 */
let cachedConfigured: boolean | null = null;
let fetchPromise: Promise<boolean> | null = null;

export async function isAIAvailable(): Promise<boolean> {
	if (cachedConfigured !== null) return cachedConfigured;

	// Deduplicate concurrent requests
	if (!fetchPromise) {
		fetchPromise = fetch('/api/v1/ai/configured')
			.then((res) => (res.ok ? res.json() : { configured: false }))
			.then((data: { configured: boolean }) => {
				cachedConfigured = data.configured;
				fetchPromise = null;
				return cachedConfigured as boolean;
			})
			.catch(() => {
				fetchPromise = null;
				return false;
			});
	}

	return fetchPromise;
}

/** Call this if you need to bust the cache (e.g. after changing AI settings). */
export function resetAIConfigCache() {
	cachedConfigured = null;
	fetchPromise = null;
}
