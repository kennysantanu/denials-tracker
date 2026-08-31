import { describe, expect, it } from 'vitest';
import { normalizeAIReasoningEffort, toChatReasoningEffort } from './reasoning';

describe('normalizeAIReasoningEffort', () => {
	it('uses low when the preference is missing or invalid', () => {
		expect(normalizeAIReasoningEffort(null)).toBe('low');
		expect(normalizeAIReasoningEffort(undefined)).toBe('low');
		expect(normalizeAIReasoningEffort('invalid')).toBe('low');
	});

	it('accepts supported preference values', () => {
		expect(normalizeAIReasoningEffort('provider_default')).toBe('provider_default');
		expect(normalizeAIReasoningEffort('none')).toBe('none');
		expect(normalizeAIReasoningEffort('low')).toBe('low');
		expect(normalizeAIReasoningEffort('medium')).toBe('medium');
		expect(normalizeAIReasoningEffort('high')).toBe('high');
	});
});

describe('toChatReasoningEffort', () => {
	it('omits reasoning_effort for provider default', () => {
		expect(toChatReasoningEffort('provider_default')).toBeUndefined();
	});

	it('passes explicit chat reasoning values through', () => {
		expect(toChatReasoningEffort('none')).toBe('none');
		expect(toChatReasoningEffort('low')).toBe('low');
		expect(toChatReasoningEffort('medium')).toBe('medium');
		expect(toChatReasoningEffort('high')).toBe('high');
	});
});
