export const DEFAULT_SYSTEM_PROMPT =
	'You are a helpful medical billing assistant for a denials tracking application. You help users understand denial claims, generate appeal letters, and analyze billing data. Be concise and professional. When generating appeal letters, use a formal business letter format. Always base your responses on the actual data provided through tool calls.';

export interface SystemPromptInput {
	base: string;
	runtime: {
		model: string;
		role: string;
		timezone: string;
	};
	currentDate?: Date;
	pageContext?: string | null;
	longThreadSummary?: string | null;
}

function section(name: string, content: string): string {
	return `<${name}>\n${content.trim()}\n</${name}>`;
}

export function buildSystemPrompt(input: SystemPromptInput): string {
	const currentDate = (input.currentDate ?? new Date()).toISOString().slice(0, 10);
	const parts = [
		section('identity', input.base),
		section(
			'rules',
			[
				'Use only data available through current context or allowed tools.',
				'Assume the current patient/task unless the user asks to compare or investigate across patients.'
			].join('\n')
		),
		section(
			'runtime',
			`model: ${input.runtime.model || 'unknown'} | user role: ${input.runtime.role || 'user'} | timezone: ${input.runtime.timezone || 'UTC'}`
		),
		section('current_date', currentDate)
	];

	if (input.longThreadSummary?.trim()) {
		parts.push(section('long_thread_summary', input.longThreadSummary));
	}

	if (input.pageContext?.trim()) {
		parts.push(section('page_context', input.pageContext));
	}

	return parts.join('\n\n');
}

export interface PageContextResult {
	text: string | null;
	chars: number;
	truncated: boolean;
}

const PAGE_CONTEXT_CHAR_CAP = 8_000;
const FIELD_CHAR_CAP = 500;

export function buildPageContextSnippet(
	pageData: Record<string, unknown> | undefined,
	totalCap = PAGE_CONTEXT_CHAR_CAP
): PageContextResult {
	if (!pageData) return { text: null, chars: 0, truncated: false };

	const lines: string[] = ['Current page context:'];
	const route = pageData.route as string | undefined;
	if (route) lines.push(`- Route: ${route}`);

	const patient = pageData.patient as Record<string, unknown> | undefined;
	if (patient) {
		const name = `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim();
		const dob = patient.date_of_birth as string | undefined;
		const patientId = patient.id as number | undefined;
		const idStr = patientId != null ? `, ID: ${patientId}` : '';
		const dobStr = dob ? ` (DOB: ${dob})` : '';
		lines.push(`- Patient: ${name}${dobStr}${idStr}`);

		const note = patient.note as string | undefined;
		if (note) lines.push(`- Patient note: "${truncate(note, FIELD_CHAR_CAP)}"`);
	}

	const files = pageData.files as Array<Record<string, unknown>> | undefined;
	if (files?.length) {
		const fileList = files.map(
			(f) => `${f.name ?? 'unknown'} - ${f.mimetype ?? 'unknown'}, ${formatFileSize(f.size as number)}`
		);
		lines.push(`- Files: ${files.length} (${fileList.join('; ')})`);
	}

	const denials = pageData.denials as Array<Record<string, unknown>> | undefined;
	if (denials?.length) {
		const total = denials.length;
		const visible = denials.slice(0, 50);
		const capped = total > visible.length ? ` (showing ${visible.length})` : '';
		lines.push(`- Denials (${total} total${capped}):`);
		for (const denial of visible) {
			const dos = (denial.service_start_date as string) ?? '?';
			const closed = denial.is_closed ? 'closed' : 'open';
			lines.push(`  - #${denial.id} | DOS: ${dos} | ${closed}`);
		}
		if (total > visible.length) {
			lines.push(`  ... and ${total - visible.length} more - use query_denials to list them`);
		}
	}

	let text = lines.join('\n');
	let truncated = false;
	if (text.length > totalCap) {
		text =
			text.slice(0, totalCap) +
			'\n[Page context was truncated. Use allowed tools for missing details.]';
		truncated = true;
	}

	return { text, chars: text.length, truncated };
}

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max)}...` : value;
}

function formatFileSize(bytes: number | undefined): string {
	if (bytes == null) return '?';
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
