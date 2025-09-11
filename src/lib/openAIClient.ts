import { PRIVATE_OPENAI_API_KEY, PRIVATE_OPENAI_API_BASE_URL } from '$env/static/private'
import OpenAI from 'openai';

export const openAIClient = new OpenAI({
		apiKey: PRIVATE_OPENAI_API_KEY,
		baseURL: PRIVATE_OPENAI_API_BASE_URL + '/v1'
	});
