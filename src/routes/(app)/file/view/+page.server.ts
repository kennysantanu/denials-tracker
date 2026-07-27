import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	createSignedUrl,
	getFileByName,
	getRelatedClaims,
	getFileViewSiblings,
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

	const fileResult = await getFileByName(locals.supabase, name);

	if (fileResult.error || !fileResult.data) {
		return {
			signedUrl: null,
			fileName: name,
			fileRecord: null,
			relatedClaims: [] as Awaited<ReturnType<typeof getRelatedClaims>>['data'],
			siblings: [] as Awaited<ReturnType<typeof getFileViewSiblings>>['data'],
			currentIndex: -1,
			previousFileName: null as string | null,
			nextFileName: null as string | null,
			backUrl: '/file',
			error: 'File not found'
		};
	}

	const uploadDate = fileResult.data.created_at.split('T')[0];
	const backUrl = `/file?date=${uploadDate}`;

	const [signedUrlResult, claimsResult, siblingsResult] = await Promise.all([
		createSignedUrl(locals.supabase, name, 60),
		getRelatedClaims(locals.supabase, name),
		getFileViewSiblings(locals.supabase, uploadDate)
	]);

	const siblings = siblingsResult.data ?? [];
	const currentIndex = siblings.findIndex((file) => file.name === name);
	const previousFileName = currentIndex > 0 ? siblings[currentIndex - 1].name : null;
	const nextFileName =
		currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1].name : null;

	if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
		return {
			signedUrl: null,
			fileName: name,
			fileRecord: fileResult.data,
			relatedClaims: claimsResult.data ?? [],
			siblings,
			currentIndex,
			previousFileName,
			nextFileName,
			backUrl,
			error: 'Could not generate file URL'
		};
	}

	logAudit(locals.supabase, user.id, 'view', 'file', name, undefined, request);

	return {
		signedUrl: signedUrlResult.data.signedUrl,
		fileName: name,
		fileRecord: fileResult.data,
		relatedClaims: claimsResult.data ?? [],
		siblings,
		currentIndex,
		previousFileName,
		nextFileName,
		backUrl
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
