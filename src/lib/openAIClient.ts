import { PRIVATE_OPENAI_API_KEY, PRIVATE_OPENAI_API_BASE_URL, PRIVATE_OPENAI_MODEL } from '$env/static/private'
import OpenAI from 'openai';

export const openAIModel = PRIVATE_OPENAI_MODEL;

export const openAIClient = new OpenAI({
		apiKey: PRIVATE_OPENAI_API_KEY,
		baseURL: PRIVATE_OPENAI_API_BASE_URL + '/v1'
	});
