import { superValidate, fail } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

// Form schema
const usersSchema = z.object({
    username: z.string(),
	password: z.string().min(6),
});

// Server load function
export const load = (async ({ locals: { supabase, safeGetSession } }) => {
    const updatePasswordForm = await superValidate(zod(usersSchema));    

    return { updatePasswordForm};
}) satisfies PageServerLoad;

// Form actions
export const actions: Actions = {
    updatePassword: async ({ request, locals: { supabase, safeGetSession } }) => {
        const updatePasswordForm = await superValidate(request, zod(usersSchema));

        if (!updatePasswordForm.valid) {
            return fail(400, { updatePasswordForm });
        }

        await supabase.auth.updateUser({ password: updatePasswordForm.data.password });

        return { updatePasswordForm };
    },
};
