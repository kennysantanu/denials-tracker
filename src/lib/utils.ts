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
 * Smooth-scroll to an element by ID.
 */
export function scrollTo(elementId: string): void {
	const el = document.getElementById(elementId);
	if (el) {
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}
