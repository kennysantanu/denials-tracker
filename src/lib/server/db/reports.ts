import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

export type DateMode = 'service' | 'lastNote';

interface ReportParams {
	startDate?: string;
	endDate?: string;
	includeClosed?: boolean;
	dateMode?: DateMode;
}

export interface ReportNote {
	id: number;
	note: string;
	created_at: string;
	username: string | null;
}

export interface ReportLabel {
	id: number;
	label_name: string;
	bg_color: string;
	txt_color: string;
}

export interface ReportInsurance {
	id: number;
	name: string;
}

export interface ReportRow {
	id: number;
	service_start_date: string;
	billed_amount: number | null;
	paid_amount: number | null;
	is_closed: boolean;
	patient: {
		id: number;
		first_name: string;
		last_name: string;
		date_of_birth: string;
	} | null;
	insurances: ReportInsurance[];
	labels: ReportLabel[];
	last_note: ReportNote | null;
}

export async function getReportData(
	supabase: SupabaseClient<Database>,
	params: ReportParams
): Promise<{ data: ReportRow[]; error: unknown }> {
	const dateMode: DateMode = params.dateMode ?? 'service';

	let query = supabase.from('denials').select(
		`
			id,
			service_start_date,
			billed_amount,
			paid_amount,
			is_closed,
			patients ( id, first_name, last_name, date_of_birth ),
			denials_insurances ( insurances ( id, name ) ),
			denials_labels ( labels ( id, label_name, bg_color, txt_color ) ),
			notes (
				id,
				note,
				created_at,
				created_by_user:users!public_notes_created_by_fkey ( username )
			)
		`
	);

	if (!params.includeClosed) {
		query = query.eq('is_closed', false);
	}

	// When filtering by service date we can push the range to the DB.
	// When filtering by last-note date we must compute the latest note per
	// denial in app code, so we skip the DB-side range filter here.
	if (dateMode === 'service') {
		if (params.startDate) {
			query = query.gte('service_start_date', params.startDate);
		}
		if (params.endDate) {
			query = query.lte('service_start_date', params.endDate);
		}
	}

	const { data, error } = await query;
	if (error || !data) {
		return { data: [], error };
	}

	// Normalize each row + compute last note.
	const rows: ReportRow[] = data.map((d) => {
		const notes: ReportNote[] = Array.isArray(d.notes)
			? d.notes.map((n) => ({
					id: n.id,
					note: n.note,
					created_at: n.created_at,
					username: n.created_by_user?.username ?? null
				}))
			: [];

		// Pick the most recent note by created_at.
		let lastNote: ReportNote | null = null;
		for (const n of notes) {
			if (!lastNote || n.created_at > lastNote.created_at) {
				lastNote = n;
			}
		}

		const insurances: ReportInsurance[] = Array.isArray(d.denials_insurances)
			? d.denials_insurances
					.map((di) => di.insurances)
					.filter((i): i is ReportInsurance => i !== null && typeof i.id === 'number')
			: [];

		const labels: ReportLabel[] = Array.isArray(d.denials_labels)
			? d.denials_labels
					.map((dl) => dl.labels)
					.filter((l): l is ReportLabel => l !== null && typeof l.id === 'number')
			: [];

		return {
			id: d.id,
			service_start_date: d.service_start_date,
			billed_amount: d.billed_amount,
			paid_amount: d.paid_amount,
			is_closed: d.is_closed,
			patient: d.patients
				? {
						id: d.patients.id,
						first_name: d.patients.first_name,
						last_name: d.patients.last_name,
						date_of_birth: d.patients.date_of_birth
					}
				: null,
			insurances,
			labels,
			last_note: lastNote
		};
	});

	// For last-note mode, filter rows whose latest note falls within the range.
	// Compare against UTC day boundaries so local-date inputs don't miss records
	// near midnight.
	let filtered = rows;
	if (dateMode === 'lastNote') {
		const startISO = params.startDate ? `${params.startDate}T00:00:00.000Z` : null;
		const endISO = params.endDate ? `${params.endDate}T23:59:59.999Z` : null;
		filtered = rows.filter((r) => {
			if (!r.last_note) return false;
			const ts = r.last_note.created_at;
			if (startISO && ts < startISO) return false;
			if (endISO && ts > endISO) return false;
			return true;
		});
	}

	// Sort newest first by the active date so the initial table view is meaningful.
	filtered.sort((a, b) => {
		if (dateMode === 'lastNote') {
			const ad = a.last_note?.created_at ?? '';
			const bd = b.last_note?.created_at ?? '';
			return bd.localeCompare(ad);
		}
		return (b.service_start_date ?? '').localeCompare(a.service_start_date ?? '');
	});

	return { data: filtered, error: null };
}
