export const load = async ({ locals: { supabase } }) => {
	
	let { data: users, error } = await supabase
	.from('users')
	.select('username')

	return { users };
}