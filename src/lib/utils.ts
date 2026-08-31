/**
 * Format a date string or Date object to a localized display format.
 */
export function formatDate(
	date: string | Date | null | undefined,
	options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' }
): string {
	if (!date) return '';
	// Date-only strings (YYYY-MM-DD) are parsed as UTC by spec, which causes
	// ±1 day shifts when converted to local time.  Force UTC display for them.
	if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		const d = new Date(date + 'T00:00:00');
		if (isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', options);
	}
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-US', options);
}

/**
 * Escape HTML special characters to prevent XSS when rendering raw HTML.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Wrap all occurrences of `query` in `text` with a <mark> highlight tag.
 * Returns an HTML string safe to use with {@html}.
 */
export function highlight(text: string | null | undefined, query: string): string {
	const safe = escapeHtml(text ?? '');
	const q = query.trim();
	if (!q) return safe;
	const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return safe.replace(
		new RegExp(`(${escaped})`, 'gi'),
		'<mark class="bg-yellow-200 rounded-sm not-italic">$1</mark>'
	);
}

/**
 * Generate a UUID v4 string.
 * Uses `crypto.randomUUID()` when available (HTTPS/localhost),
 * falls back to a `crypto.getRandomValues()`-based polyfill otherwise.
 */
export function generateUUID(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c === 'x' ? 0 : 3);
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

/**
 * Smooth-scroll to an element by ID.
 */
export function scrollTo(elementId: string): void {
	const el = document.getElementById(elementId);
	if (el) {
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}
