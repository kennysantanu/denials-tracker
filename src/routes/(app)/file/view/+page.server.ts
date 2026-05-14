import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	createSignedUrl,
	getFileByName,
	getRelatedClaims,
	updateFileMetadata,
	deleteFile
} from '$lib/server/db/files';
import { logAudit } from '$lib/server/audit';
import { requirePermission } from '$lib/server/authz';

export const load: PageServerLoad = async (event) => {
	const { locals, url, request } = event;
	const user = await locals.getUser();
	if (!user) {
		redirect(303, '/signin');
	}

	await requirePermission(event, 'file.read', { resourceType: 'file' });

	const name = url.searchParams.get('name');
	if (!name) {
		redirect(303, '/file');
	}

	const [signedUrlResult, fileResult, claimsResult] = await Promise.all([
		createSignedUrl(locals.supabase, name, 60),
		getFileByName(locals.supabase, name),
		getRelatedClaims(locals.supabase, name)
	]);

	if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
		return {
			signedUrl: null,
			fileName: name,
			fileRecord: null,
			relatedClaims: [] as typeof claimsResult.data,
			error: 'Could not generate file URL'
		};
	}

	logAudit(locals.supabase, user.id, 'view', 'file', name, undefined, request);

	return {
		signedUrl: signedUrlResult.data.signedUrl,
		fileName: name,
		fileRecord: fileResult.data ?? null,
		relatedClaims: claimsResult.data ?? []
	};
};

export const actions: Actions = {
	updateFileInfo: async (event) => {
		const { locals, request } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'file.update', { resourceType: 'file' });

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const status = formData.get('status') as string;
		const note = formData.get('note') as string;

		if (!name) return fail(400, { error: 'File name is required' });

		const { error: updateError } = await updateFileMetadata(locals.supabase, name, {
			status,
			note
		});

		if (updateError) {
			return fail(500, { error: 'Failed to update file info' });
		}

		logAudit(locals.supabase, user.id, 'update', 'file', name, { status, note }, request);

		return { success: true };
	},

	deleteFile: async (event) => {
		const { locals, request } = event;
		const user = await locals.getUser();
		if (!user) redirect(303, '/signin');

		await requirePermission(event, 'file.delete', { resourceType: 'file' });

		const formData = await request.formData();
		const name = formData.get('name') as string;

		if (!name) return fail(400, { error: 'File name is required' });

		const { error: deleteError } = await deleteFile(locals.supabase, name);

		if (deleteError) {
			return fail(500, { error: 'Failed to delete file' });
		}

		logAudit(locals.supabase, user.id, 'delete', 'file', name, undefined, request);

		redirect(303, '/file');
	}
};
