import { describe, expect, it } from 'vitest';
import { prepareLongThreadMessages } from './longThread';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

describe('prepareLongThreadMessages', () => {
	it('omits summary below threshold', () => {
		const result = prepareLongThreadMessages([{ role: 'user', content: 'hello' }], 8192, 100);

		expect(result.used).toBe(false);
		expect(result.summary).toBeNull();
	});

	it('can force summary below threshold for context-length retries', () => {
		const result = prepareLongThreadMessages(
			Array.from({ length: 20 }, (_, i) => ({
				role: i % 2 === 0 ? 'user' : 'assistant',
				content: `message ${i} patient id 123 denial id 456`
			})),
			8192,
			100,
			{ forceSummary: true }
		);

		expect(result.used).toBe(true);
		expect(result.summary).toContain('patient id 123');
		expect(result.summary).toContain('denial id 456');
	});

	it('keeps a recent tail verbatim when summarizing', () => {
		const messages: ChatCompletionMessageParam[] = Array.from({ length: 34 }, (_, i) => ({
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `message ${i} patient id 123`
		}));

		const result = prepareLongThreadMessages(messages, 8192, 100);

		expect(result.used).toBe(true);
		expect(result.messages.at(-1)).toEqual(messages.at(-1));
		expect(result.summary).toContain('patient id 123');
	});

	it('does not split before a tool result', () => {
		const messages: ChatCompletionMessageParam[] = Array.from({ length: 20 }, (_, i) => ({
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `message ${i}`
		}));
		messages.push({
			role: 'assistant',
			content: null,
			tool_calls: [
				{
					id: 'call_1',
					type: 'function',
					function: { name: 'query_denials', arguments: '{}' }
				}
			]
		});
		messages.push({ role: 'tool', tool_call_id: 'call_1', content: 'result' });
		for (let i = 0; i < 20; i++) messages.push({ role: 'user', content: `tail ${i}` });

		const result = prepareLongThreadMessages(messages, 256, 100);

		expect(result.messages[0].role).not.toBe('tool');
	});
});
