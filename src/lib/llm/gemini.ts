import { buildCommentPrompt } from '../prompt-templates';
import type {
	CommentRequest,
	CommentVariant,
	HistoryEntry,
	Tone,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';

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

function parseRetryAfter(response: Response): number | undefined {
	const value = response.headers.get('retry-after');
	if (!value) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) ? seconds : undefined;
}

function validateVariants(value: unknown): CommentVariant[] {
	if (!Array.isArray(value) || value.length !== 3) {
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			'Gemini returned an unexpected response shape.',
		);
	}

	const variants = value.map((item) => {
		if (!item || typeof item !== 'object') {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned an invalid comment variant.',
			);
		}

		const candidate = item as Record<string, unknown>;
		if (
			typeof candidate.tone !== 'string' ||
			!candidate.tone.trim() ||
			typeof candidate.text !== 'string' ||
			!candidate.text.trim() ||
			typeof candidate.congratulation !== 'boolean'
		) {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned an invalid comment variant.',
			);
		}

		return {
			tone: candidate.tone as Tone,
			text: candidate.text.trim(),
			congratulation: candidate.congratulation,
		};
	});

	if (new Set(variants.map((variant) => variant.tone)).size !== 3) {
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			'Gemini did not return all three requested tones.',
		);
	}

	return variants;
}

export async function generateWithGemini(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const model = settings.model || 'gemini-2.5-flash';
	const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);

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
			});
		} catch {
			throw new LlmProviderError(
				'NETWORK_ERROR',
				'Could not reach Gemini. Check your connection and try again.',
			);
		}

		let payload: GeminiResponse;
		try {
			payload = (await response.json()) as GeminiResponse;
		} catch {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned a response that could not be read.',
			);
		}

		if (!response.ok) {
			const message = payload.error?.message ?? 'Gemini rejected the request.';
			if (response.status === 429) {
				throw new LlmProviderError(
					'RATE_LIMITED',
					message,
					parseRetryAfter(response),
				);
			}
			if (
				response.status === 400 ||
				response.status === 401 ||
				response.status === 403
			) {
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
			variants = validateVariants(JSON.parse(rawText) as unknown);
		} catch (error) {
			if (error instanceof LlmProviderError) throw error;
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Gemini returned malformed JSON.',
			);
		}

		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			continue;
		}

		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'Gemini returned repetitive comment variants.',
	);
}
