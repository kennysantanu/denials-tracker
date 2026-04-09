import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import { getLabels, createLabel, updateLabel, deleteLabel } from '$lib/server/db/labels';
import type { PageServerLoad, Actions } from './$types';

const createLabelSchema = z.object({
	label_name: z.string().min(1, 'Label name is required'),
	bg_color: z.string().min(1, 'Background color is required').default('#3b82f6'),
	txt_color: z.string().min(1, 'Text color is required').default('#ffffff'),
	order: z.coerce.number().default(0)
});

const updateLabelSchema = z.object({
	id: z.coerce.number(),
	label_name: z.string().min(1, 'Label name is required'),
	bg_color: z.string().min(1, 'Background color is required'),
	txt_color: z.string().min(1, 'Text color is required'),
	order: z.coerce.number()
});

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	const { data: labels } = await getLabels(locals.supabase);

	const createForm = await superValidate(zod(createLabelSchema));
	const updateForm = await superValidate(zod(updateLabelSchema));

	return {
		labels: labels ?? [],
		createForm,
		updateForm
	};
};

export const actions: Actions = {
	createLabel: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(createLabelSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const { data: label, error } = await createLabel(locals.supabase, form.data);
		if (error) return fail(500, { createForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'create', 'label', String(label?.id), form.data, request);

		return message(form, 'Label created successfully');
	},

	updateLabel: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const form = await superValidate(request, zod(updateLabelSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const { id, ...rest } = form.data;
		const { error } = await updateLabel(locals.supabase, id, rest);
		if (error) return fail(500, { updateForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'label', String(id), rest, request);

		return message(form, 'Label updated successfully');
	},

	deleteLabel: async ({ request, locals }) => {
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'Invalid label ID' });

		const { error } = await deleteLabel(locals.supabase, id);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'delete', 'label', String(id), undefined, request);

		return { success: true };
	}
};
