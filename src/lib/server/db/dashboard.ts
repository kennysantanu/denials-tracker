import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase';

export async function getDashboardStats(supabase: SupabaseClient<Database>) {
	const { data, error } = await supabase
		.from('denials')
		.select('billed_amount, paid_amount')
		.eq('is_closed', false);

	if (error) return { data: null, error };

	const rows = data ?? [];
	const totalOpen = rows.length;
	const totalBilled = rows.reduce((sum, r) => sum + (r.billed_amount ?? 0), 0);
	const totalPaid = rows.reduce((sum, r) => sum + (r.paid_amount ?? 0), 0);
	const recoveryRate = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;

	return {
		data: { totalOpen, totalBilled, totalPaid, recoveryRate },
		error: null
	};
}

export async function getRecentActivity(
	supabase: SupabaseClient<Database>,
	limit: number = 10
) {
	return await supabase
		.from('audit_log')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(limit);
}

export async function getFollowUpsDueThisWeek(supabase: SupabaseClient<Database>) {
	const today = new Date();
	const dayOfWeek = today.getDay();
	const endOfWeek = new Date(today);
	endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
	endOfWeek.setHours(23, 59, 59, 999);

	const todayStr = today.toISOString().split('T')[0];
	const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

	return await supabase
		.from('denials')
		.select(
			`
			*,
			patients ( id, first_name, last_name )
		`
		)
		.eq('is_closed', false)
		.gte('follow_up_date', todayStr)
		.lte('follow_up_date', endOfWeekStr)
		.order('follow_up_date');
}

export async function getDenialsByLabel(supabase: SupabaseClient<Database>) {
	const { data, error } = await supabase
		.from('denials_labels')
		.select('label_id, labels ( id, label_name, bg_color, txt_color )');

	if (error) return { data: null, error };

	const rows = data ?? [];
	const counts = new Map<number, { label: (typeof rows)[number]['labels']; count: number }>();

	for (const row of rows) {
		const labelId = row.label_id;
		const existing = counts.get(labelId);
		if (existing) {
			existing.count++;
		} else {
			counts.set(labelId, { label: row.labels, count: 1 });
		}
	}

	return {
		data: Array.from(counts.values()),
		error: null
	};
}
