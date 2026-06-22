import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export interface ToolContext {
	supabase: SupabaseClient<Database>;
	userId: string;
	patientId?: number;
}

// --- Tool definitions for OpenAI function calling ---

export const aiToolDefinitions: ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'get_denial_summary',
			description:
				'Get a summary of a specific denial including its notes, amounts, dates, insurances, and labels.',
			parameters: {
				type: 'object',
				properties: {
					denial_id: {
						type: 'number',
						description: 'The ID of the denial to summarize'
					}
				},
				required: ['denial_id']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'generate_appeal_letter',
			description:
				'Generate a draft appeal letter for a denied claim based on denial details and notes.',
			parameters: {
				type: 'object',
				properties: {
					denial_id: {
						type: 'number',
						description: 'The ID of the denial to generate an appeal for'
					}
				},
				required: ['denial_id']
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'query_denials',
			description:
				'Query denials with optional filters. Returns a list of matching denials with summary info.',
			parameters: {
				type: 'object',
				properties: {
					patient_id: {
						type: 'number',
						description: 'Filter by patient ID'
					},
					is_closed: {
						type: 'boolean',
						description: 'Filter by open/closed status'
					},
					limit: {
						type: 'number',
						description: 'Maximum number of results (default 20)'
					}
				}
			}
		}
	}
];

// --- Permission requirements per tool ---
// Canonical permission keys (Phase 5). The chat route checks these against
// `effectivePermissions` returned by `loadEffectivePermissions`.
export const toolPermissions: Record<string, string> = {
	get_denial_summary: 'ai.summary',
	generate_appeal_letter: 'ai.appeal',
	query_denials: 'ai.query_denials'
};

// --- Tool handlers ---

async function handleGetDenialSummary(
	ctx: ToolContext,
	args: { denial_id: number }
): Promise<string> {
	try {
		const { data: denial, error } = await ctx.supabase
			.from('denials')
			.select('*')
			.eq('id', args.denial_id)
			.single();

		if (error || !denial) return JSON.stringify({ error: 'Denial not found' });

		const [notesResult, insResult, lblResult] = await Promise.all([
			ctx.supabase
				.from('notes')
				.select('*')
				.eq('denial_id', args.denial_id)
				.order('created_at', { ascending: false }),
			ctx.supabase
				.from('denials_insurances')
				.select('insurance_id, insurances(name)')
				.eq('denial_id', args.denial_id),
			ctx.supabase
				.from('denials_labels')
				.select('label_id, labels(label_name)')
				.eq('denial_id', args.denial_id)
		]);

		const { data: patient } = await ctx.supabase
			.from('patients')
			.select('first_name, last_name, date_of_birth')
			.eq('id', denial.patient_id)
			.single();

		return JSON.stringify({
			denial: {
				id: denial.id,
				service_start_date: denial.service_start_date,
				service_end_date: denial.service_end_date,
				billed_amount: denial.billed_amount,
				paid_amount: denial.paid_amount,
				is_closed: denial.is_closed,
				follow_up_date: denial.follow_up_date,
				created_at: denial.created_at
			},
			patient: patient
				? {
						name: `${patient.first_name} ${patient.last_name}`,
						dob: patient.date_of_birth
					}
				: null,
			notes: (notesResult.data ?? []).map((n) => ({
				note: n.note,
				created_at: n.created_at,
				created_by: n.created_by
			})),
			insurances: (insResult.data ?? []).map((i: any) => i.insurances?.name).filter(Boolean),
			labels: (lblResult.data ?? []).map((l: any) => l.labels?.label_name).filter(Boolean)
		});
	} catch {
		return JSON.stringify({ error: 'Failed to fetch denial summary' });
	}
}

async function handleGenerateAppealLetter(
	ctx: ToolContext,
	args: { denial_id: number }
): Promise<string> {
	// Reuse summary data to provide context for appeal generation
	return handleGetDenialSummary(ctx, args);
}

async function handleQueryDenials(
	ctx: ToolContext,
	args: { patient_id?: number; is_closed?: boolean; limit?: number }
): Promise<string> {
	try {
		let query = ctx.supabase
			.from('denials')
			.select(
				'id, patient_id, service_start_date, billed_amount, paid_amount, is_closed, follow_up_date, patients(first_name, last_name)'
			)
			.order('created_at', { ascending: false })
			.limit(args.limit ?? 20);

		if (args.patient_id !== undefined) {
			query = query.eq('patient_id', args.patient_id);
		}
		if (args.is_closed !== undefined) {
			query = query.eq('is_closed', args.is_closed);
		}

		const { data, error } = await query;
		if (error) return JSON.stringify({ error: 'Failed to query denials' });

		return JSON.stringify({
			count: data?.length ?? 0,
			denials: (data ?? []).map((d: any) => ({
				id: d.id,
				patient: d.patients ? `${d.patients.first_name} ${d.patients.last_name}` : null,
				service_start_date: d.service_start_date,
				billed_amount: d.billed_amount,
				paid_amount: d.paid_amount,
				is_closed: d.is_closed,
				follow_up_date: d.follow_up_date
			}))
		});
	} catch {
		return JSON.stringify({ error: 'Failed to query denials' });
	}
}

// --- Dispatcher ---

export async function executeToolCall(
	ctx: ToolContext,
	toolName: string,
	args: Record<string, unknown>
): Promise<string> {
	switch (toolName) {
		case 'get_denial_summary':
			return handleGetDenialSummary(ctx, args as { denial_id: number });
		case 'generate_appeal_letter':
			return handleGenerateAppealLetter(ctx, args as { denial_id: number });
		case 'query_denials':
			return handleQueryDenials(
				ctx,
				args as { patient_id?: number; is_closed?: boolean; limit?: number }
			);
		default:
			return JSON.stringify({ error: `Unknown tool: ${toolName}` });
	}
}
