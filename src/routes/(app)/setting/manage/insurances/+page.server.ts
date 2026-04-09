import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import { getInsurances, createInsurance, updateInsurance, deleteInsurance } from '$lib/server/db/insurances';
import type { PageServerLoad, Actions } from './$types';

const createInsuranceSchema = z.object({
	name: z.string().min(1, 'Name is required'),
	note: z.string().optional()
});

const updateInsuranceSchema = z.object({
	id: z.coerce.number(),
	name: z.string().min(1, 'Name is required'),
	note: z.string().optional()
});

export const load: PageServerLoad = async ({ locals, parent }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const parentData = await parent();
	const permissions = (parentData as any).permissions ?? {};
	if (!permissions['manage_insurances']) {
		return fail(403, { error: 'Forbidden' }) as any;
	}

	const { data: insurances } = await getInsurances(locals.supabase);

	const createForm = await superValidate(zod(createInsuranceSchema));
	const updateForm = await superValidate(zod(updateInsuranceSchema));

	return { insurances: insurances ?? [], createForm, updateForm };
};

export const actions: Actions = {
	createInsurance: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(createInsuranceSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const { data: insurance, error } = await createInsurance(locals.supabase, form.data);
		if (error) return fail(500, { createForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'create', 'insurance', String(insurance?.id), form.data, request);

		return message(form, 'Insurance created successfully');
	},

	updateInsurance: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(updateInsuranceSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const { id, ...rest } = form.data;
		const { error } = await updateInsurance(locals.supabase, id, rest);
		if (error) return fail(500, { updateForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'insurance', String(id), rest, request);

		return message(form, 'Insurance updated successfully');
	},

	deleteInsurance: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'Invalid insurance ID' });

		const { error } = await deleteInsurance(locals.supabase, id);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'delete', 'insurance', String(id), undefined, request);

		return { success: true };
	}
};
