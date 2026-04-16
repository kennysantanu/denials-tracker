import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, scrollTo } from './utils';

describe('formatDate', () => {
	it('returns formatted date for valid string', () => {
		// Use ISO with time to avoid UTC-midnight timezone shift
		const result = formatDate('2024-01-15T12:00:00');
		expect(result).toBe('01/15/2024');
	});

	it('handles date-only string without timezone shift', () => {
		// Date-only strings like YYYY-MM-DD should never shift due to timezone
		const result = formatDate('2026-01-28');
		expect(result).toBe('01/28/2026');
	});

	it('returns formatted date for Date object', () => {
		const result = formatDate(new Date(2024, 0, 15));
		expect(result).toBe('01/15/2024');
	});

	it('returns empty string for null', () => {
		expect(formatDate(null)).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(formatDate(undefined)).toBe('');
	});

	it('returns empty string for invalid date string', () => {
		expect(formatDate('not-a-date')).toBe('');
	});

	it('uses custom options when provided', () => {
		const result = formatDate(new Date(2024, 0, 15), {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
		expect(result).toBe('01/15/2024');
	});
});

describe('scrollTo', () => {
	let origDocument: typeof globalThis.document;

	beforeEach(() => {
		origDocument = globalThis.document;
		globalThis.document = { getElementById: vi.fn() } as any;
	});

	afterEach(() => {
		globalThis.document = origDocument;
	});

	it('calls scrollIntoView on found element', () => {
		const mockElement = { scrollIntoView: vi.fn() };
		vi.mocked(document.getElementById).mockReturnValue(mockElement as unknown as HTMLElement);

		scrollTo('test-id');

		expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
			behavior: 'smooth',
			block: 'start'
		});
	});

	it('does nothing when element is not found', () => {
		vi.mocked(document.getElementById).mockReturnValue(null);

		// Should not throw
		expect(() => scrollTo('missing-id')).not.toThrow();
	});
});
