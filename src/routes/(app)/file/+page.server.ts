import type { PageServerLoad } from './$types';

const formatDate = (dateString: string): string => {
    return dateString.replace(/-/g, '/');
}

export const load: PageServerLoad = async () => {
    
    return { };
}

export const actions = {
	uploadNewFile: async ({ request, locals: { supabase, safeGetSession } }) => {

        const form = await request.formData();
        const files = form.getAll('files') as File[];

        const now = new Date();
        const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        
        for (const file of files) {
            const { data, error } = await supabase
                .storage
                .from('files')
                .upload(`${timestamp}/${file.name}`, file);

            if (error) {
                return { };
            }

            const { } = await supabase
                .from('files')
                .insert({ 
                    name: `${timestamp}/${file.name}`, 
                    size: file.size, 
                    mimetype: file.type, 
                    metadata: { status: 'New', note: '' } 
                });
        }
        
        return { };
    },
    getFileList: async ({ request, locals: { supabase, safeGetSession } }) => {

        const form = await request.formData();
        const date = form.get('date');

        if (!date) {
            return { fileList: [] };
        }

        const folderPath = formatDate(date);

        const { data, error } = await supabase
            .from('files')
            .select('name, created_at, size, metadata')
            .like('name', `%${folderPath}%`)
            .order('created_at', { ascending: true });

        if (error) {
            return { fileList: [] };
        }

        let fileList = data;

        return { fileList };

    },
}
