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
import { parseRetryAfter, validateVariants } from './parse-response';
import { validateModelId } from './registry';

const REQUEST_TIMEOUT_MS = 30_000;

interface GeminiResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
	}>;
	error?: {
		code?: number;
		message?: string;
		status?: string;
	};
}

export async function generateWithGemini(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const model = validateModelId(settings.model || 'gemini-2.5-flash');
	const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		logger.info('Gemini request started.', { model, attempt });

		let response: Response;
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-goog-api-key': settings.apiKeys.gemini ?? '',
				},
				body: JSON.stringify({
					systemInstruction: {
						parts: [{ text: prompt.system }],
					},
					contents: [
						{
							role: 'user',
							parts: [{ text: prompt.user }],
						},
					],
					generationConfig: {
						temperature: attempt === 0 ? 0.92 : 0.97,
						topP: 0.9,
						maxOutputTokens: 1_024,
						thinkingConfig: {
							thinkingBudget: 0,
						},
						responseMimeType: 'application/json',
						responseSchema: {
							type: 'ARRAY',
							minItems: 3,
							maxItems: 3,
							items: {
								type: 'OBJECT',
								required: ['tone', 'text', 'congratulation'],
								properties: {
									tone: {
										type: 'STRING',
									},
									text: { type: 'STRING' },
									congratulation: { type: 'BOOLEAN' },
								},
							},
						},
					},
				}),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeout);
			if (error instanceof DOMException && error.name === 'AbortError') {
				logger.error('Gemini request timed out.', { model, attempt });
				throw new LlmProviderError(
					'NETWORK_ERROR',
					'Gemini request timed out. Try again.',
				);
			}
			logger.error('Gemini network error.', { model, attempt });
			throw new LlmProviderError(
				'NETWORK_ERROR',
				'Could not reach Gemini. Check your connection and try again.',
			);
		} finally {
			clearTimeout(timeout);
		}

		let payload: GeminiResponse;
		try {
			payload = (await response.json()) as GeminiResponse;
		} catch {
			logger.error('Gemini returned unparseable response.', { model, status: response.status });
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned a response that could not be read.',
			);
		}

		if (!response.ok) {
			const message = payload.error?.message ?? 'Gemini rejected the request.';
			logger.warn('Gemini API error.', { model, status: response.status, message });
			if (response.status === 429) {
				throw new LlmProviderError(
					'RATE_LIMITED',
					message,
					parseRetryAfter(response),
				);
			}
			if (response.status === 400) {
				throw new LlmProviderError('INVALID_REQUEST', message);
			}
			if (response.status === 401 || response.status === 403) {
				throw new LlmProviderError('INVALID_API_KEY', message);
			}
			throw new LlmProviderError('PROVIDER_ERROR', message);
		}

		const rawText = payload.candidates?.[0]?.content?.parts
			?.map((part) => part.text ?? '')
			.join('')
			.trim();

		if (!rawText) {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned no comment variants.',
			);
		}

		let variants: CommentVariant[];
		try {
			variants = validateVariants(JSON.parse(rawText) as unknown, 'Gemini');
		} catch (error) {
			if (error instanceof LlmProviderError) throw error;
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned malformed JSON.',
			);
		}

		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			logger.info('Gemini freshness retry triggered.', { model });
			continue;
		}

		logger.info('Gemini request succeeded.', { model, attempt });
		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'Gemini returned repetitive comment variants.',
	);
}
