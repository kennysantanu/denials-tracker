
export const load = async ({ request, locals: { supabase, safeGetSession } }) => {    
    
    return { }
}

export const actions = {
	getDenialReport: async ({ request, locals: { supabase, safeGetSession } }) => {        

        let { data: denials, error } = await supabase
        .from('denials')
        .select('*, patients(*), notes(id, denial_id, created_at, modified_at, created_by:created_by(username), modified_by:modified_by(username), note), labels(*)')  
        .order('created_at', { referencedTable: 'notes', ascending: false })
        .limit(1, { referencedTable: 'notes' })
        return { denials };
    },    
}
