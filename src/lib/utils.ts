/**
 * Format a date string or Date object to a localized display format.
 */
export function formatDate(
	date: string | Date | null | undefined,
	options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string {
	if (!date) return '';
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
