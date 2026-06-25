import { describe, expect, it } from 'vitest';
import { buildPageContextSnippet, buildSystemPrompt } from './systemPrompt';

describe('buildSystemPrompt', () => {
	it('renders sections in stable order', () => {
		const prompt = buildSystemPrompt({
			base: 'Base',
			runtime: { model: 'local', role: 'admin', timezone: 'America/Los_Angeles' },
			currentDate: new Date('2026-06-25T12:34:56Z'),
			longThreadSummary: 'Summary',
			pageContext: 'Context'
		});

		expect(prompt.indexOf('<identity>')).toBeLessThan(prompt.indexOf('<rules>'));
		expect(prompt.indexOf('<rules>')).toBeLessThan(prompt.indexOf('<runtime>'));
		expect(prompt.indexOf('<runtime>')).toBeLessThan(prompt.indexOf('<current_date>'));
		expect(prompt.indexOf('<current_date>')).toBeLessThan(
			prompt.indexOf('<long_thread_summary>')
		);
		expect(prompt.indexOf('<long_thread_summary>')).toBeLessThan(
			prompt.indexOf('<page_context>')
		);
	});

	it('omits missing optional sections cleanly and uses ISO date only', () => {
		const prompt = buildSystemPrompt({
			base: 'Base',
			runtime: { model: 'local', role: 'user', timezone: 'UTC' },
			currentDate: new Date('2026-06-25T12:34:56Z')
		});

		expect(prompt).toContain('<current_date>\n2026-06-25\n</current_date>');
		expect(prompt).not.toContain('<page_context>');
		expect(prompt).not.toContain('<long_thread_summary>');
	});
});

describe('buildPageContextSnippet', () => {
	it('truncates at the total cap with a warning', () => {
		const result = buildPageContextSnippet(
			{ patient: { first_name: 'A', last_name: 'B', note: 'x'.repeat(200) } },
			80
		);

		expect(result.truncated).toBe(true);
		expect(result.text).toContain('Page context was truncated');
	});

	it('does not include truncation warning when under cap', () => {
		const result = buildPageContextSnippet({ patient: { first_name: 'A', last_name: 'B' } });

		expect(result.truncated).toBe(false);
		expect(result.text).not.toContain('Page context was truncated');
	});
});
