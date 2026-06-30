export const AI_REASONING_EFFORT_OPTIONS = [
	'provider_default',
	'none',
	'low',
	'medium',
	'high'
] as const;

export type AIReasoningEffortPreference = (typeof AI_REASONING_EFFORT_OPTIONS)[number];
export type ChatReasoningEffort = Exclude<AIReasoningEffortPreference, 'provider_default'>;

const AI_REASONING_EFFORT_SET = new Set<string>(AI_REASONING_EFFORT_OPTIONS);

export function normalizeAIReasoningEffort(
	value: string | null | undefined
): AIReasoningEffortPreference {
	if (value && AI_REASONING_EFFORT_SET.has(value)) return value as AIReasoningEffortPreference;
	return 'low';
}

export function toChatReasoningEffort(
	value: string | null | undefined
): ChatReasoningEffort | undefined {
	const normalized = normalizeAIReasoningEffort(value);
	return normalized === 'provider_default' ? undefined : normalized;
}
