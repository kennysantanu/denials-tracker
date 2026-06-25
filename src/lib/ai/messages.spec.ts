import { describe, expect, it } from 'vitest';
import { buildApiMessages, type AiChatMessage } from './messages';

const now = '2026-06-25T00:00:00.000Z';

function msg(message: Partial<AiChatMessage> & Pick<AiChatMessage, 'role'>): AiChatMessage {
	return {
		...message,
		id: crypto.randomUUID(),
		content: message.content ?? '',
		createdAt: now
	};
}

describe('buildApiMessages', () => {
	it('preserves paired assistant and tool messages', () => {
		const built = buildApiMessages([
			msg({ role: 'user', content: 'Check denial 1' }),
			msg({ role: 'tool', toolCallId: 'call_1', content: 'denial result' }),
			msg({
				role: 'assistant',
				content: 'Denial 1 is open',
				toolCalls: [{ id: 'call_1', name: 'query_denials', args: '{"id":1}' }]
			})
		]);

		expect(built).toEqual([
			{ role: 'user', content: 'Check denial 1' },
			{
				role: 'assistant',
				content: null,
				tool_calls: [
					{
						id: 'call_1',
						type: 'function',
						function: { name: 'query_denials', arguments: '{"id":1}' }
					}
				]
			},
			{ role: 'tool', tool_call_id: 'call_1', content: 'denial result' },
			{ role: 'assistant', content: 'Denial 1 is open' }
		]);
	});

	it('drops orphan tool calls', () => {
		const built = buildApiMessages([
			msg({
				role: 'assistant',
				content: '',
				toolCalls: [{ id: 'missing', name: 'query_denials', args: '{}' }]
			})
		]);

		expect(built).toEqual([]);
	});

	it('drops orphan tool results', () => {
		const built = buildApiMessages([
			msg({ role: 'tool', toolCallId: 'orphan', content: 'result' })
		]);

		expect(built).toEqual([]);
	});

	it('maps duplicate tool names by id', () => {
		const built = buildApiMessages([
			msg({ role: 'tool', toolCallId: 'call_a', content: 'result A' }),
			msg({ role: 'tool', toolCallId: 'call_b', content: 'result B' }),
			msg({
				role: 'assistant',
				content: '',
				toolCalls: [
					{ id: 'call_a', name: 'query_denials', args: '{"q":"a"}' },
					{ id: 'call_b', name: 'query_denials', args: '{"q":"b"}' }
				]
			})
		]);

		expect(built.map((m) => (m.role === 'tool' ? m.tool_call_id : m.role))).toEqual([
			'assistant',
			'call_a',
			'call_b'
		]);
	});

	it('preserves separate tool-call rounds in one assistant turn', () => {
		const built = buildApiMessages([
			msg({ role: 'user', content: 'Do a multi-step lookup' }),
			msg({ role: 'tool', toolCallId: 'call_a', content: 'result A', round: 0 }),
			msg({ role: 'tool', toolCallId: 'call_b', content: 'result B', round: 1 }),
			msg({
				role: 'assistant',
				content: 'Final answer',
				toolCalls: [
					{ id: 'call_a', name: 'query_denials', args: '{"q":"a"}' },
					{ id: 'call_b', name: 'query_denials', args: '{"q":"b"}' }
				]
			})
		]);

		expect(built).toEqual([
			{ role: 'user', content: 'Do a multi-step lookup' },
			{
				role: 'assistant',
				content: null,
				tool_calls: [
					{
						id: 'call_a',
						type: 'function',
						function: { name: 'query_denials', arguments: '{"q":"a"}' }
					}
				]
			},
			{ role: 'tool', tool_call_id: 'call_a', content: 'result A' },
			{
				role: 'assistant',
				content: null,
				tool_calls: [
					{
						id: 'call_b',
						type: 'function',
						function: { name: 'query_denials', arguments: '{"q":"b"}' }
					}
				]
			},
			{ role: 'tool', tool_call_id: 'call_b', content: 'result B' },
			{ role: 'assistant', content: 'Final answer' }
		]);
	});
});
