import { logger } from '../logger';
import { buildCommentPrompt } from '../prompt-templates';
import type {
	CommentRequest,
	CommentVariant,
	HistoryEntry,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';
import { parseContent, parseRetryAfter } from './parse-response';
import { getDefaultModel, validateModelId } from './registry';

const REQUEST_TIMEOUT_MS = 30_000;

interface AnthropicResponse {
	content?: Array<{
		type: string;
		text?: string;
	}>;
	error?: {
		type?: string;
		message?: string;
	};
}

export async function generateWithAnthropic(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const model = validateModelId(settings.model || getDefaultModel('anthropic'));
	const endpoint = 'https://api.anthropic.com/v1/messages';

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		logger.info('Anthropic request started.', { model, attempt });

		let response: Response;
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': settings.apiKeys.anthropic ?? '',
					'anthropic-version': '2023-06-01',
					// Required for browser-to-API calls (not a CORS header — Anthropic allows this)
			'anthropic-dangerous-direct-browser-access': 'true',
				},
				body: JSON.stringify({
					model,
					max_tokens: 2_048,
					system: prompt.system,
					messages: [
						{ role: 'user', content: prompt.user },
					],
					temperature: attempt === 0 ? 0.72 : 0.82,
					top_p: 0.85,
				}),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeout);
			if (error instanceof DOMException && error.name === 'AbortError') {
				logger.error('Anthropic request timed out.', { model, attempt });
				throw new LlmProviderError(
					'NETWORK_ERROR',
					'Anthropic request timed out. Try again.',
				);
			}
			logger.error('Anthropic network error.', { model, attempt });
			throw new LlmProviderError(
				'NETWORK_ERROR',
				'Could not reach Anthropic. Check your connection and try again.',
			);
		} finally {
			clearTimeout(timeout);
		}

		let payload: AnthropicResponse;
		try {
			payload = (await response.json()) as AnthropicResponse;
		} catch {
			logger.error('Anthropic returned unparseable response.', { model, status: response.status });
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Anthropic returned a response that could not be read.',
			);
		}

		if (!response.ok) {
			const message =
				payload.error?.message ?? 'Anthropic rejected the request.';
			logger.warn('Anthropic API error.', { model, status: response.status, message });
			if (response.status === 401 || response.status === 403) {
				throw new LlmProviderError('INVALID_API_KEY', message);
			}
			if (response.status === 429) {
				throw new LlmProviderError(
					'RATE_LIMITED',
					message,
					parseRetryAfter(response),
				);
			}
			throw new LlmProviderError('PROVIDER_ERROR', message);
		}

		const rawText = payload.content
			?.filter((block) => block.type === 'text')
			.map((block) => block.text ?? '')
			.join('')
			.trim();

		if (!rawText) {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Anthropic returned no comment variants.',
			);
		}

		const variants = parseContent(rawText, 'Anthropic');
		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			logger.info('Anthropic freshness retry triggered.', { model });
			continue;
		}

		logger.info('Anthropic request succeeded.', { model, attempt });
		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'Anthropic returned repetitive comment variants.',
	);
}
