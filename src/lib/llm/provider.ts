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

	// All other providers use the OpenAI-compatible chat completions API
	const openaiCompatProviders = new Set([
		'openai', 'openrouter', 'groq', 'together',
		'mistral', 'deepseek', 'cohere', 'perplexity', 'xai',
	]);

	if (openaiCompatProviders.has(settings.provider)) {
		return generateWithOpenAICompat(request, settings, history);
	}

	throw new LlmProviderError(
		'PROVIDER_ERROR',
		'The selected LLM provider is not supported.',
	);
}
