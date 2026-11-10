import type {
	CommentRequest,
	CommentVariant,
	HistoryEntry,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';
import { generateWithAnthropic } from './anthropic';
import { generateWithGemini } from './gemini';
import { generateWithOpenCode } from './opencode';
import { generateWithOpenAICompat } from './openai-compat';

export async function generateComments(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const isLocal =
		settings.provider === 'ollama' ||
		(settings.provider === 'custom' &&
			/localhost|127\.0\.0\.1/i.test(settings.customApiBase ?? ''));

	if (!navigator.onLine && !isLocal) {
		throw new LlmProviderError(
			'OFFLINE',
			'You appear to be offline. Check your internet connection and try again.',
		);
	}

	const apiKey = settings.apiKeys[settings.provider] ?? '';

	if (!apiKey.trim() && settings.provider !== 'ollama' && settings.provider !== 'custom') {
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

	if (settings.provider === 'custom') {
		const base = settings.customApiBase?.trim() || '';
		const model = settings.model || '';
		const isOpenCode =
			model.includes('/') ||
			/:(?:4096|4097|4098)\b/i.test(base) ||
			base.endsWith('/api');

		if (isOpenCode) {
			return generateWithOpenCode(request, settings, history);
		}
	}

	return generateWithOpenAICompat(request, settings, history);
}
