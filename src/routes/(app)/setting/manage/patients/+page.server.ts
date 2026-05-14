import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod4 as zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import { logAudit } from '$lib/server/audit';
import { getPatients, createPatient, updatePatient } from '$lib/server/db/patients';
import { archivePatient } from '$lib/server/retention';
import { requirePermission } from '$lib/server/authz';
import type { PageServerLoad, Actions } from './$types';

const createPatientSchema = z.object({
	first_name: z.string().min(1, 'First name is required'),
	last_name: z.string().min(1, 'Last name is required'),
	date_of_birth: z.string().min(1, 'Date of birth is required'),
	note: z.string().optional()
});

const updatePatientSchema = z.object({
	id: z.coerce.number(),
	first_name: z.string().min(1, 'First name is required'),
	last_name: z.string().min(1, 'Last name is required'),
	date_of_birth: z.string().min(1, 'Date of birth is required'),
	note: z.string().optional()
});

export const load: PageServerLoad = async (event) => {
	const { locals } = event;
	const user = await locals.getUser();
	if (!user) redirect(303, '/signin');

	await requirePermission(event, 'patient.read', { resourceType: 'patient' });

	const { data: patients, error } = await getPatients(locals.supabase);

	logAudit(locals.supabase, user!.id, 'view', 'patients', null, undefined, undefined);

	const createForm = await superValidate(zod(createPatientSchema));
	const updateForm = await superValidate(zod(updatePatientSchema));

	return { patients: patients ?? [], createForm, updateForm };
};

export const actions: Actions = {
	createPatient: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'patient.create', { resourceType: 'patient' });

		const form = await superValidate(request, zod(createPatientSchema));
		if (!form.valid) return fail(400, { createForm: form });

		const { data: patient, error } = await createPatient(locals.supabase, form.data);
		if (error) return fail(500, { createForm: form, error: error.message });

		logAudit(
			locals.supabase,
			user.id,
			'create',
			'patient',
			String(patient?.id),
			form.data,
			request
		);

		return message(form, 'Patient created successfully');
	},

	updatePatient: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'patient.update', { resourceType: 'patient' });

		const form = await superValidate(request, zod(updatePatientSchema));
		if (!form.valid) return fail(400, { updateForm: form });

		const { id, ...rest } = form.data;
		const { error } = await updatePatient(locals.supabase, id, rest);
		if (error) return fail(500, { updateForm: form, error: error.message });

		logAudit(locals.supabase, user.id, 'update', 'patient', String(id), rest, request);

		return message(form, 'Patient updated successfully');
	},

	deletePatient: async (event) => {
		const { request, locals } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'patient.archive', { resourceType: 'patient' });

		const formData = await request.formData();
		const id = Number(formData.get('id'));
		if (!id) return fail(400, { error: 'Invalid patient ID' });

		const { error } = await archivePatient(locals.supabase, id);
		if (error) return fail(500, { error: error.message });

		logAudit(locals.supabase, user.id, 'archive', 'patient', String(id), undefined, request);

		return { success: true };
	}
};
