import type {
	CommentRequest,
	CommentVariant,
	HistoryEntry,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';
import { generateWithGemini } from './gemini';
import { generateWithOpenRouter } from './openrouter';

export async function generateComments(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const apiKey = settings.apiKeys[settings.provider];

	if (!apiKey.trim()) {
		throw new LlmProviderError(
			'MISSING_API_KEY',
			'Add your API key in the extension popup first.',
		);
	}

	if (settings.provider === 'gemini') {
		return generateWithGemini(request, settings, history);
	}

	if (settings.provider === 'openrouter') {
		return generateWithOpenRouter(request, settings, history);
	}

	throw new LlmProviderError(
		'PROVIDER_ERROR',
		'The selected LLM provider is not supported.',
	);
}
