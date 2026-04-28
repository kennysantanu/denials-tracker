import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

export type NoteWithUser = {
	id: number;
	note: string;
	created_at: string;
	users: { username: string | null } | null;
};

export type FollowUpDenial = Database['public']['Tables']['denials']['Row'] & {
	patients: {
		id: number;
		first_name: string;
		last_name: string;
		date_of_birth: string | null;
	} | null;
	denials_insurances: Array<{ insurances: { id: number; name: string } | null }>;
	denials_labels: Array<{
		labels: { id: number; label_name: string; bg_color: string; txt_color: string } | null;
	}>;
	notes: NoteWithUser[];
};

export interface GroupedFollowUps {
	overdue: FollowUpDenial[];
	thisWeek: FollowUpDenial[];
	upcoming: FollowUpDenial[];
	noDate: FollowUpDenial[];
}

const DENIAL_SELECT = `
	*,
	patients ( id, first_name, last_name, date_of_birth ),
	denials_insurances ( insurances ( id, name ) ),
	denials_labels ( labels ( id, label_name, bg_color, txt_color ) ),
	notes ( id, note, created_at, users!created_by ( username ) )
`;

/**
 * Fetch all open denials that have a follow-up date set.
 */
export async function getOpenFollowUps(supabase: SupabaseClient<Database>) {
	return await supabase
		.from('denials')
		.select(DENIAL_SELECT)
		.eq('is_closed', false)
		.not('follow_up_date', 'is', null)
		.order('follow_up_date', { ascending: true });
}

/**
 * Fetch all open denials that have no follow-up date set.
 */
export async function getNoFollowUpDenials(supabase: SupabaseClient<Database>) {
	return await supabase
		.from('denials')
		.select(DENIAL_SELECT)
		.eq('is_closed', false)
		.is('follow_up_date', null)
		.order('created_at', { ascending: false });
}

/**
 * Group follow-ups into Overdue, This Week, Upcoming. noDate is populated by the caller.
 */
export function groupFollowUps(rows: FollowUpDenial[], now: Date = new Date()): GroupedFollowUps {
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const endOfWeek = new Date(today);
	const daysUntilSunday = 7 - today.getDay();
	endOfWeek.setDate(today.getDate() + daysUntilSunday - 1);
	endOfWeek.setHours(23, 59, 59, 999);

	const overdue: FollowUpDenial[] = [];
	const thisWeek: FollowUpDenial[] = [];
	const upcoming: FollowUpDenial[] = [];

	for (const row of rows) {
		if (!row.follow_up_date) continue;
		const [y, m, d] = row.follow_up_date.split('-').map(Number);
		const due = new Date(y, (m ?? 1) - 1, d ?? 1);

		if (due < today) {
			overdue.push(row);
		} else if (due <= endOfWeek) {
			thisWeek.push(row);
		} else {
			upcoming.push(row);
		}
	}

	return { overdue, thisWeek, upcoming, noDate: [] };
}
