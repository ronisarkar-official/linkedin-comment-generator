import type {
	CommentRequest,
	CommentVariant,
	HistoryEntry,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';
import { generateWithAnthropic } from './anthropic';
import { generateWithGemini } from './gemini';
import { generateWithOpenAICompat } from './openai-compat';

export async function generateComments(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	if (!navigator.onLine) {
		throw new LlmProviderError(
			'OFFLINE',
			'You appear to be offline. Check your internet connection and try again.',
		);
	}

	const apiKey = settings.apiKeys[settings.provider] ?? '';

	if (!apiKey.trim()) {
		throw new LlmProviderError(
			'MISSING_API_KEY',
			'Add your API key in the extension popup first.',
		);
	}

	if (settings.provider === 'gemini') {
		return generateWithGemini(request, settings, history);
	}

	if (settings.provider === 'anthropic') {
		return generateWithAnthropic(request, settings, history);
	}

	return generateWithOpenAICompat(request, settings, history);
}
