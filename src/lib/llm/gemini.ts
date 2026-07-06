import { buildCommentPrompt } from '../prompt-templates';
import type {
	CommentRequest,
	CommentVariant,
	Tone,
	UserSettings,
} from '../types';
import { LlmProviderError } from '../types';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const validTones = new Set<Tone>(['professional', 'witty', 'supportive']);

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
			!validTones.has(candidate.tone as Tone) ||
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
): Promise<CommentVariant[]> {
	const prompt = buildCommentPrompt(request);

	let response: Response;
	try {
		response = await fetch(GEMINI_ENDPOINT, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': settings.apiKey,
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
					temperature: 0.92,
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
									enum: ['professional', 'witty', 'supportive'],
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

	try {
		return validateVariants(JSON.parse(rawText) as unknown);
	} catch (error) {
		if (error instanceof LlmProviderError) throw error;
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			'Gemini returned malformed JSON.',
		);
	}
}
