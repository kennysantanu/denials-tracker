import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { z } from 'zod';
import { logAppEvent } from '../appEvents';
import { WikiUnavailableError, isWikiEnabled, isWikiRuntimeSupported, searchWiki } from './wiki';

// ---------------------------------------------------------------------------
// AI tool registry — plans/AI_TOOL_ARCHITECTURE_PLAN.md
//
// Exactly three read-only tools: search_patients, search_denials, and the
// optional search_wiki (exposed only when the wiki feature is enabled).
//
// The JSON schema shown to the model helps it call a tool correctly; the
// server-side executor is the real security boundary. For every call it:
//   1. rejects unknown tool names;
//   2. parses arguments with a strict Zod schema (unknown keys rejected);
//   3. reauthorizes every required permission immediately before execution;
//   4. queries with the authenticated user's Supabase client so RLS applies;
//   5. enforces row, character, note, and runtime limits;
//   6. audits the attempt with IDs and counts only — never PHI payloads;
//   7. returns safe errors without stack traces or record-existence leakage.
// ---------------------------------------------------------------------------

export interface ToolContext {
	supabase: SupabaseClient<Database>;
	userId: string;
	patientId?: number;
	requestId?: string | null;
}

export interface ToolExecutionData {
	/** JSON-serializable payload returned to the model. */
	data: unknown;
	/** Audit metadata: IDs and counts only, never note text or demographics. */
	meta?: {
		rowCount?: number;
		patientIds?: number[];
		denialIds?: number[];
		/** Stable relative wiki citation IDs for search_wiki results. */
		citationIds?: string[];
	};
}

export interface ToolDefinition<Input> {
	name: string;
	description: string;
	/** Model-facing JSON schema. Mirrors `schema`; hand-written for provider compatibility. */
	parameters: Record<string, unknown>;
	/** Server-side strict validation — the real argument boundary. */
	schema: {
		safeParse(
			data: unknown
		): { success: true; data: Input } | { success: false; error: z.ZodError };
	};
	/** Every permission must currently be granted for the tool to be exposed or executed. */
	requiredPermissions: string[];
	timeoutMs: number;
	maxResultChars: number;
	/**
	 * Optional feature gate (e.g. wiki_enabled). Checked when projecting tools
	 * for a request and again at execution time; false means the tool neither
	 * appears nor runs.
	 */
	isAvailable?(context: ToolContext): Promise<boolean>;
	execute(context: ToolContext, input: Input): Promise<ToolExecutionData>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegisteredTool = ToolDefinition<any>;

// --- Limits ---

const MAX_PATIENT_RESULTS = 10;
const MAX_DENIAL_RESULTS = 20;
const MAX_NOTES_PER_DENIAL = 20;
const NOTE_CHAR_CAP = 500;

// --- Input schemas (strict: unknown properties are rejected) ---

const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
	.refine((value) => {
		const parsed = new Date(`${value}T00:00:00Z`);
		return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
	}, 'Invalid calendar date');

const safeId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

const searchPatientsSchema = z
	.strictObject({
		patient_id: safeId.optional(),
		name: z.string().trim().min(2).max(100).optional(),
		date_of_birth: isoDate.optional(),
		include_inactive: z.boolean().default(false),
		limit: z.number().int().min(1).max(MAX_PATIENT_RESULTS).default(5)
	})
	.refine(
		(value) =>
			value.patient_id !== undefined ||
			value.name !== undefined ||
			value.date_of_birth !== undefined,
		{ message: 'Provide at least one of patient_id, name, or date_of_birth' }
	);

const searchDenialsSchema = z
	.strictObject({
		denial_id: safeId.optional(),
		patient_id: safeId.optional(),
		is_closed: z.boolean().optional(),
		follow_up_from: isoDate.optional(),
		follow_up_to: isoDate.optional(),
		service_from: isoDate.optional(),
		service_to: isoDate.optional(),
		limit: z.number().int().min(1).max(MAX_DENIAL_RESULTS).default(10)
	})
	.refine(
		(value) =>
			value.denial_id !== undefined ||
			value.patient_id !== undefined ||
			value.is_closed !== undefined ||
			value.follow_up_from !== undefined ||
			value.follow_up_to !== undefined ||
			value.service_from !== undefined ||
			value.service_to !== undefined,
		{
			message:
				'Provide denial_id or at least one filter (patient_id, is_closed, follow_up range, or service range)'
		}
	)
	.refine(
		(value) =>
			!(value.follow_up_from && value.follow_up_to) || value.follow_up_from <= value.follow_up_to,
		{ message: 'follow_up_from must be on or before follow_up_to' }
	)
	.refine(
		(value) => !(value.service_from && value.service_to) || value.service_from <= value.service_to,
		{ message: 'service_from must be on or before service_to' }
	);

type SearchPatientsInput = z.infer<typeof searchPatientsSchema>;
type SearchDenialsInput = z.infer<typeof searchDenialsSchema>;

const searchWikiSchema = z.strictObject({
	query: z.string().trim().min(2).max(300),
	limit: z.number().int().min(1).max(5).default(4)
});

type SearchWikiInput = z.infer<typeof searchWikiSchema>;

// --- Result helpers ---

function truncateText(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Split a free-text name into safe tokens for PostgREST ilike filters.
 * Strips characters that carry special meaning in PostgREST filter syntax or
 * SQL LIKE patterns (commas, parens, dots, %, _, ...) before they reach a query.
 */
function sanitizeNameTokens(name: string): string[] {
	return name
		.replace(/[^A-Za-z0-9' -]+/g, ' ')
		.split(/\s+/)
		.map((token) => token.trim())
		.filter((token) => token.length > 0)
		.slice(0, 3)
		.map((token) => token.slice(0, 40));
}

/** Read a single string field from a PostgREST many-to-one embedded relation. */
function relatedName(row: unknown, key: string, field: string): string | null {
	if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
	const value = (row as Record<string, unknown>)[key];
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const name = (value as Record<string, unknown>)[field];
	return typeof name === 'string' ? name : null;
}

function patientDisplayName(value: unknown): string | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const record = value as Record<string, unknown>;
	const first = typeof record.first_name === 'string' ? record.first_name : '';
	const last = typeof record.last_name === 'string' ? record.last_name : '';
	const name = `${first} ${last}`.trim();
	return name === '' ? null : name;
}

// --- Tool handlers (always user-scoped so RLS applies) ---

async function executeSearchPatients(
	ctx: ToolContext,
	input: SearchPatientsInput
): Promise<ToolExecutionData> {
	// Explicit safe field list only — never select('*') and never return
	// insurance, contact, address, note, or denial data from this tool.
	let query = ctx.supabase
		.from('patients')
		.select('id, first_name, last_name, date_of_birth, is_active');

	if (input.patient_id !== undefined) query = query.eq('id', input.patient_id);
	if (!input.include_inactive) query = query.eq('is_active', true);
	if (input.date_of_birth !== undefined) query = query.eq('date_of_birth', input.date_of_birth);
	for (const token of sanitizeNameTokens(input.name ?? '')) {
		query = query.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%`);
	}

	const { data, error } = await query
		.order('last_name', { ascending: true })
		.order('first_name', { ascending: true })
		.order('id', { ascending: true })
		.limit(input.limit);

	if (error) throw new Error(`patient search failed: ${error.code ?? 'unknown'}`);

	// RLS already hides inaccessible rows, so an empty result is the neutral
	// not-available response for both missing and inaccessible records.
	const patients = (data ?? []).map((row) => ({
		patient_id: row.id,
		name: `${row.first_name} ${row.last_name}`.trim(),
		date_of_birth: row.date_of_birth,
		is_active: row.is_active
	}));

	return {
		data: {
			patients,
			count: patients.length,
			retrieved_at: new Date().toISOString()
		},
		meta: {
			rowCount: patients.length,
			patientIds: patients.map((patient) => patient.patient_id)
		}
	};
}

async function fetchDenialDetail(ctx: ToolContext, denialId: number): Promise<ToolExecutionData> {
	const { data: denial, error } = await ctx.supabase
		.from('denials')
		.select(
			'id, patient_id, service_start_date, service_end_date, billed_amount, paid_amount, is_closed, follow_up_date, created_at'
		)
		.eq('id', denialId)
		.maybeSingle();

	if (error) throw new Error(`denial lookup failed: ${error.code ?? 'unknown'}`);

	if (!denial) {
		// Neutral not-available: identical for missing and RLS-inaccessible records.
		return {
			data: {
				available: false,
				message: 'No accessible denial found for the given denial_id.',
				retrieved_at: new Date().toISOString()
			},
			meta: { rowCount: 0, denialIds: [] }
		};
	}

	const [notesResult, insurancesResult, labelsResult, patientResult] = await Promise.all([
		ctx.supabase
			.from('notes')
			.select('id, note, created_at')
			.eq('denial_id', denialId)
			.order('created_at', { ascending: false })
			.limit(MAX_NOTES_PER_DENIAL + 1),
		ctx.supabase.from('denials_insurances').select('insurances(name)').eq('denial_id', denialId),
		ctx.supabase.from('denials_labels').select('labels(label_name)').eq('denial_id', denialId),
		ctx.supabase
			.from('patients')
			.select('id, first_name, last_name, date_of_birth')
			.eq('id', denial.patient_id)
			.maybeSingle()
	]);

	const fetchError =
		notesResult.error ?? insurancesResult.error ?? labelsResult.error ?? patientResult.error;
	if (fetchError) throw new Error(`denial detail fetch failed: ${fetchError.code ?? 'unknown'}`);

	const noteRows = notesResult.data ?? [];
	const notesOmitted = noteRows.length > MAX_NOTES_PER_DENIAL;
	const notes = noteRows.slice(0, MAX_NOTES_PER_DENIAL).map((note) => ({
		note: truncateText(note.note, NOTE_CHAR_CAP),
		created_at: note.created_at
	}));

	const patient = patientResult.data;

	return {
		data: {
			available: true,
			denial: {
				id: denial.id,
				patient_id: denial.patient_id,
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
						patient_id: patient.id,
						name: `${patient.first_name} ${patient.last_name}`.trim(),
						date_of_birth: patient.date_of_birth
					}
				: null,
			insurances: (insurancesResult.data ?? [])
				.map((row) => relatedName(row, 'insurances', 'name'))
				.filter((name): name is string => name !== null),
			labels: (labelsResult.data ?? [])
				.map((row) => relatedName(row, 'labels', 'label_name'))
				.filter((name): name is string => name !== null),
			notes,
			notes_omitted: notesOmitted,
			retrieved_at: new Date().toISOString()
		},
		meta: { rowCount: 1, patientIds: [denial.patient_id], denialIds: [denial.id] }
	};
}

async function fetchDenialList(
	ctx: ToolContext,
	input: SearchDenialsInput
): Promise<ToolExecutionData> {
	// All filters go through the Supabase query builder; the model can never
	// supply SQL fragments or column names.
	let query = ctx.supabase
		.from('denials')
		.select(
			'id, patient_id, service_start_date, service_end_date, billed_amount, paid_amount, is_closed, follow_up_date, patients(first_name, last_name)'
		)
		.order('created_at', { ascending: false })
		.order('id', { ascending: false })
		.limit(input.limit + 1); // one extra row to compute has_more

	if (input.patient_id !== undefined) query = query.eq('patient_id', input.patient_id);
	if (input.is_closed !== undefined) query = query.eq('is_closed', input.is_closed);
	if (input.follow_up_from !== undefined) query = query.gte('follow_up_date', input.follow_up_from);
	if (input.follow_up_to !== undefined) query = query.lte('follow_up_date', input.follow_up_to);
	if (input.service_from !== undefined) query = query.gte('service_start_date', input.service_from);
	if (input.service_to !== undefined) query = query.lte('service_start_date', input.service_to);

	const { data, error } = await query;
	if (error) throw new Error(`denial search failed: ${error.code ?? 'unknown'}`);

	const rows = data ?? [];
	const hasMore = rows.length > input.limit;
	// Concise rows only — note bodies are never returned from a list search.
	const denials = rows.slice(0, input.limit).map((row) => ({
		denial_id: row.id,
		patient_id: row.patient_id,
		patient: patientDisplayName(row.patients),
		service_start_date: row.service_start_date,
		service_end_date: row.service_end_date,
		billed_amount: row.billed_amount,
		paid_amount: row.paid_amount,
		is_closed: row.is_closed,
		follow_up_date: row.follow_up_date
	}));

	return {
		data: {
			denials,
			count: denials.length,
			has_more: hasMore,
			retrieved_at: new Date().toISOString()
		},
		meta: {
			rowCount: denials.length,
			patientIds: [...new Set(denials.map((denial) => denial.patient_id))],
			denialIds: denials.map((denial) => denial.denial_id)
		}
	};
}

async function executeSearchDenials(
	ctx: ToolContext,
	input: SearchDenialsInput
): Promise<ToolExecutionData> {
	if (input.denial_id !== undefined) return fetchDenialDetail(ctx, input.denial_id);
	return fetchDenialList(ctx, input);
}

// --- Registry ---

const searchPatientsTool: ToolDefinition<SearchPatientsInput> = {
	name: 'search_patients',
	description:
		'Find a patient the current user is allowed to read. Use this to resolve a name or date of birth to a patient ID before calling search_denials. Returns only patient ID, name, date of birth, and active status.',
	parameters: {
		type: 'object',
		properties: {
			patient_id: { type: 'number', description: 'Exact patient ID' },
			name: {
				type: 'string',
				description: 'Full or partial patient name, matched case-insensitively'
			},
			date_of_birth: { type: 'string', description: 'Exact date of birth, YYYY-MM-DD' },
			include_inactive: {
				type: 'boolean',
				description: 'Include inactive (archived) patients. Default false.'
			},
			limit: { type: 'number', description: 'Maximum results, 1-10. Default 5.' }
		}
	},
	schema: searchPatientsSchema,
	requiredPermissions: ['ai.chat', 'patient.read'],
	timeoutMs: 10_000,
	maxResultChars: 8_000,
	execute: executeSearchPatients
};

const searchDenialsTool: ToolDefinition<SearchDenialsInput> = {
	name: 'search_denials',
	description:
		'Retrieve one denial in detail by denial_id, or a bounded list of denials the current user may read, filtered by patient, open/closed status, follow-up dates, or service dates. Requires denial_id or at least one filter. A detailed lookup includes payer, amounts, status, labels, follow-up date, and recent notes; use it for summaries and appeal drafts.',
	parameters: {
		type: 'object',
		properties: {
			denial_id: {
				type: 'number',
				description: 'Exact denial ID for a detailed single-denial lookup'
			},
			patient_id: { type: 'number', description: 'Filter by patient ID' },
			is_closed: {
				type: 'boolean',
				description: 'Filter by open (false) or closed (true) status'
			},
			follow_up_from: { type: 'string', description: 'Follow-up date on/after, YYYY-MM-DD' },
			follow_up_to: { type: 'string', description: 'Follow-up date on/before, YYYY-MM-DD' },
			service_from: { type: 'string', description: 'Service start date on/after, YYYY-MM-DD' },
			service_to: { type: 'string', description: 'Service start date on/before, YYYY-MM-DD' },
			limit: { type: 'number', description: 'Maximum rows for list searches, 1-20. Default 10.' }
		}
	},
	schema: searchDenialsSchema,
	requiredPermissions: ['ai.chat', 'ai.query_denials', 'denial.read'],
	timeoutMs: 10_000,
	maxResultChars: 24_000,
	execute: executeSearchDenials
};

async function executeSearchWiki(
	ctx: ToolContext,
	input: SearchWikiInput
): Promise<ToolExecutionData> {
	const outcome = await searchWiki(ctx.supabase, input);
	return {
		data: {
			sections: outcome.sections,
			count: outcome.sections.length,
			retrieved_at: new Date().toISOString()
		},
		meta: {
			rowCount: outcome.sections.length,
			citationIds: outcome.sections.map((section) => section.citation_id)
		}
	};
}

const searchWikiTool: ToolDefinition<SearchWikiInput> = {
	name: 'search_wiki',
	description:
		'Search the office wiki for documented procedures, policies, definitions, payer workflows, and templates. Returns the most relevant heading-sized sections with citations. Use this for operational "how do we" questions; use search_denials for live case facts. If results are weak or absent, say the wiki does not document the answer rather than inventing one.',
	parameters: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Operational question or keywords, 2-300 characters'
			},
			limit: { type: 'number', description: 'Maximum sections to return, 1-5. Default 4.' }
		},
		required: ['query']
	},
	schema: searchWikiSchema,
	requiredPermissions: ['ai.chat', 'wiki.read'],
	timeoutMs: 10_000,
	maxResultChars: 16_000,
	isAvailable: async (ctx) => isWikiRuntimeSupported() && (await isWikiEnabled(ctx.supabase)),
	execute: executeSearchWiki
};

export const toolRegistry: Record<string, RegisteredTool> = {
	search_patients: searchPatientsTool,
	search_denials: searchDenialsTool,
	search_wiki: searchWikiTool
};

// --- Model-facing projection ---

/**
 * Tools to expose for one request: exactly those whose composite permission
 * requirements are fully satisfied right now AND whose feature gate is open.
 * Execution-time checks in executeToolCall() are the second, authoritative
 * boundary (plans/AI_TOOL_ARCHITECTURE_PLAN.md §6).
 */
export async function getVisibleToolDefinitions(
	ctx: ToolContext,
	effectivePermissions: Record<string, boolean>
): Promise<ChatCompletionTool[]> {
	const permitted = Object.values(toolRegistry).filter((tool) =>
		tool.requiredPermissions.every((key) => effectivePermissions[key] === true)
	);
	const availability = await Promise.all(
		permitted.map((tool) =>
			tool.isAvailable ? tool.isAvailable(ctx).catch(() => false) : Promise.resolve(true)
		)
	);
	return permitted
		.filter((_, index) => availability[index])
		.map((tool) => ({
			type: 'function',
			function: {
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters
			}
		}));
}

// --- Interaction type mapping for the chat-level ai_interactions row ---

export const toolInteractionType: Record<string, string> = {
	search_patients: 'patient_search_tool',
	search_denials: 'denial_search_tool',
	search_wiki: 'wiki_search_tool'
};

// --- Executor ---

class ToolTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	// The underlying query is not cancelled when the timeout wins; the cap only
	// bounds how long the tool loop waits. Query-level limits keep that benign.
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new ToolTimeoutError(`timed out after ${timeoutMs}ms`)),
			timeoutMs
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}

interface ReauthResult {
	allowed: boolean;
	missing?: string;
	roleIds: number[];
}

/**
 * Fresh permission resolution immediately before execution. Deliberately does
 * NOT honor break_glass.admin: per the architecture plan, break-glass access
 * must not automatically expose AI tools without a separately designed,
 * audited workflow.
 */
async function reauthorizeTool(
	supabase: SupabaseClient<Database>,
	userId: string,
	requiredPermissions: string[]
): Promise<ReauthResult> {
	const { data: assignments } = await supabase
		.from('user_role_assignments')
		.select('role_id')
		.eq('user_id', userId)
		.is('revoked_at', null);

	const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
	if (roleIds.length === 0) {
		return { allowed: false, missing: requiredPermissions[0], roleIds };
	}

	const { data: grants } = await supabase
		.from('role_permissions')
		.select('permission_key')
		.in('role_id', roleIds)
		.in('permission_key', requiredPermissions);

	const granted = new Set((grants ?? []).map((grant) => grant.permission_key));
	const missing = requiredPermissions.find((key) => !granted.has(key));
	return { allowed: missing === undefined, missing, roleIds };
}

interface ToolAuditEntry {
	tool: string;
	outcome: 'success' | 'denied' | 'failed';
	reason?: string;
	roleIds?: number[];
	missingPermission?: string;
	durationMs: number;
	resultChars?: number;
	meta?: ToolExecutionData['meta'];
}

/**
 * Per-attempt audit event on the app_events stream. Records IDs and counts
 * only — never arguments, note text, or patient demographics (plan §12).
 */
function auditToolCall(ctx: ToolContext, entry: ToolAuditEntry): void {
	logAppEvent(ctx.supabase, {
		eventName: 'ai.tool_call',
		featureArea: 'ai',
		outcome: entry.outcome,
		actorUserId: ctx.userId,
		actorRoleIds: entry.roleIds ?? [],
		permissionKey: entry.missingPermission ?? null,
		subjectPatientId: entry.meta?.patientIds?.length === 1 ? entry.meta.patientIds[0] : null,
		subjectDenialId: entry.meta?.denialIds?.length === 1 ? entry.meta.denialIds[0] : null,
		requestId: ctx.requestId ?? null,
		durationMs: entry.durationMs,
		count: entry.meta?.rowCount ?? null,
		metadata: {
			tool: entry.tool,
			reason: entry.reason ?? null,
			resultChars: entry.resultChars ?? null,
			patientIds: entry.meta?.patientIds ?? [],
			denialIds: entry.meta?.denialIds ?? [],
			citationIds: entry.meta?.citationIds ?? []
		}
	});
}

function toolError(message: string): string {
	return JSON.stringify({ error: message });
}

function formatZodIssues(error: z.ZodError): string {
	return error.issues
		.slice(0, 5)
		.map((issue) =>
			issue.path.length > 0
				? `${issue.path.map(String).join('.')}: ${issue.message}`
				: issue.message
		)
		.join('; ');
}

/**
 * Execute one tool call through the single server-side boundary: registry
 * lookup, execution-time reauthorization, strict argument parsing, limits,
 * and audit. Never throws — the model always receives a safe JSON string.
 */
export async function executeToolCall(
	ctx: ToolContext,
	toolName: string,
	rawArgs: string
): Promise<string> {
	const startedAt = Date.now();
	const tool = toolRegistry[toolName];

	if (!tool) {
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'denied',
			reason: 'unknown_tool',
			durationMs: Date.now() - startedAt
		});
		return toolError('Unknown tool.');
	}

	const auth = await reauthorizeTool(ctx.supabase, ctx.userId, tool.requiredPermissions);
	if (!auth.allowed) {
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'denied',
			reason: 'missing_permission',
			roleIds: auth.roleIds,
			missingPermission: auth.missing,
			durationMs: Date.now() - startedAt
		});
		return toolError('Not authorized to use this tool.');
	}

	// Feature gate after authorization: users without the permission always
	// see "Not authorized" and cannot probe whether the feature is enabled.
	if (tool.isAvailable && !(await tool.isAvailable(ctx).catch(() => false))) {
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'denied',
			reason: 'feature_disabled',
			roleIds: auth.roleIds,
			durationMs: Date.now() - startedAt
		});
		return toolError('This tool is currently unavailable.');
	}

	let parsedArgs: unknown;
	try {
		parsedArgs = rawArgs.trim() === '' ? {} : JSON.parse(rawArgs);
	} catch {
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'failed',
			reason: 'validation_error',
			roleIds: auth.roleIds,
			durationMs: Date.now() - startedAt
		});
		return toolError('Invalid tool arguments: not valid JSON.');
	}

	const parsed = tool.schema.safeParse(parsedArgs);
	if (!parsed.success) {
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'failed',
			reason: 'validation_error',
			roleIds: auth.roleIds,
			durationMs: Date.now() - startedAt
		});
		return toolError(`Invalid tool arguments: ${formatZodIssues(parsed.error)}`);
	}

	let result: ToolExecutionData;
	try {
		result = await withTimeout(tool.execute(ctx, parsed.data), tool.timeoutMs);
	} catch (err) {
		if (err instanceof ToolTimeoutError) {
			auditToolCall(ctx, {
				tool: toolName,
				outcome: 'failed',
				reason: 'timeout',
				roleIds: auth.roleIds,
				durationMs: Date.now() - startedAt
			});
			return toolError('The query took too long. Try a narrower search.');
		}
		if (err instanceof WikiUnavailableError) {
			// The feature was disabled or the wiki path became unreadable between
			// the availability check and the read — fail safely (plan §8).
			auditToolCall(ctx, {
				tool: toolName,
				outcome: 'failed',
				reason: 'unavailable',
				roleIds: auth.roleIds,
				durationMs: Date.now() - startedAt
			});
			return toolError('Wiki search is currently unavailable.');
		}
		console.error(`[ai/tools] ${toolName} execution failed:`, err);
		auditToolCall(ctx, {
			tool: toolName,
			outcome: 'failed',
			reason: 'internal_error',
			roleIds: auth.roleIds,
			durationMs: Date.now() - startedAt
		});
		return toolError('The tool failed to complete.');
	}

	let serialized = JSON.stringify(result.data);
	const truncated = serialized.length > tool.maxResultChars;
	if (truncated) {
		serialized = `${serialized.slice(0, tool.maxResultChars)}…[truncated]`;
	}

	auditToolCall(ctx, {
		tool: toolName,
		outcome: 'success',
		reason: truncated ? 'result_truncated' : undefined,
		roleIds: auth.roleIds,
		durationMs: Date.now() - startedAt,
		resultChars: serialized.length,
		meta: result.meta
	});
	return serialized;
}
