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

export const OPENROUTER_MODEL = 'openrouter/free';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const validTones = new Set<Tone>(['professional', 'witty', 'supportive']);

interface OpenRouterResponse {
	choices?: Array<{
		message?: {
			content?: string | Array<{ type?: string; text?: string }>;
		};
		error?: {
			message?: string;
		};
	}>;
	error?: {
		code?: number;
		message?: string;
	};
}

function validateVariants(value: unknown): CommentVariant[] {
	if (!Array.isArray(value) || value.length !== 3) {
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			'OpenRouter returned an unexpected response shape.',
		);
	}

	const variants = value.map((item) => {
		if (!item || typeof item !== 'object') {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'OpenRouter returned an invalid comment variant.',
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
				'OpenRouter returned an invalid comment variant.',
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
			'OpenRouter did not return all three requested tones.',
		);
	}

	return variants;
}

function parseRetryAfter(response: Response): number | undefined {
	const value = response.headers.get('retry-after');
	if (!value) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) ? seconds : undefined;
}

function inferCongratulation(text: string): boolean {
	return /\b(congrats?|congratulat(e|ions|ing)|well done|proud of you|happy for you|celebrat(e|ion|ing))\b/i.test(
		text,
	);
}

function parseContent(content: string): CommentVariant[] {
	const normalized = content
		.trim()
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```$/, '');

	const candidates = new Set<string>([normalized]);
	const fencedBlocks = [...content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
	fencedBlocks.forEach((match) => candidates.add(match[1].trim()));

	const arrayStart = normalized.indexOf('[');
	const arrayEnd = normalized.lastIndexOf(']');
	if (arrayStart >= 0 && arrayEnd > arrayStart) {
		candidates.add(normalized.slice(arrayStart, arrayEnd + 1));
	}

	for (const candidate of candidates) {
		for (const json of [candidate, candidate.replace(/,\s*([}\]])/g, '$1')]) {
			try {
				const parsed = JSON.parse(json) as unknown;
				if (Array.isArray(parsed)) return validateVariants(parsed);
				if (parsed && typeof parsed === 'object') {
					const record = parsed as Record<string, unknown>;
					for (const key of ['variants', 'comments', 'data', 'result']) {
						if (Array.isArray(record[key]))
							return validateVariants(record[key]);
					}
				}
			} catch {
				continue;
			}
		}
	}

	const labelledVariants: CommentVariant[] = [];
	const labelPattern =
		/(?:^|\n)\s*(?:\d+[.)]\s*)?(professional|witty|supportive)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:\d+[.)]\s*)?(?:professional|witty|supportive)\s*[:\-]|$)/gi;

	for (const match of normalized.matchAll(labelPattern)) {
		const text = match[2]
			.trim()
			.replace(/^['"]|['"]$/g, '')
			.replace(/^[-*]\s*/, '');
		if (text) {
			labelledVariants.push({
				tone: match[1].toLowerCase() as Tone,
				text,
				congratulation: inferCongratulation(text),
			});
		}
	}

	if (labelledVariants.length === 3) return validateVariants(labelledVariants);

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'OpenRouter returned a response that could not be parsed.',
	);
}

function getMessageContent(
	content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((part) => part.type === undefined || part.type === 'text')
		.map((part) => part.text ?? '')
		.join('\n')
		.trim();
}

export async function generateWithOpenRouter(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);

		let response: Response;
		try {
			response = await fetch(OPENROUTER_ENDPOINT, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${settings.apiKeys.openrouter}`,
					'Content-Type': 'application/json',
					'X-OpenRouter-Title': 'LinkedIn Comment Generator',
				},
				body: JSON.stringify({
					model: OPENROUTER_MODEL,
					messages: [
						{ role: 'system', content: prompt.system },
						{ role: 'user', content: prompt.user },
					],
					temperature: attempt === 0 ? 0.72 : 0.82,
					top_p: 0.85,
					max_completion_tokens: 2_048,
					response_format: {
						type: 'json_schema',
						json_schema: {
							name: 'comment_variants',
							strict: true,
							schema: {
								type: 'array',
								minItems: 3,
								maxItems: 3,
								items: {
									type: 'object',
									additionalProperties: false,
									required: ['tone', 'text', 'congratulation'],
									properties: {
										tone: {
											type: 'string',
											enum: ['professional', 'witty', 'supportive'],
										},
										text: { type: 'string' },
										congratulation: { type: 'boolean' },
									},
								},
							},
						},
					},
				}),
			});
		} catch {
			throw new LlmProviderError(
				'NETWORK_ERROR',
				'Could not reach OpenRouter. Check your connection and try again.',
			);
		}

		let payload: OpenRouterResponse;
		try {
			payload = (await response.json()) as OpenRouterResponse;
		} catch {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'OpenRouter returned a response that could not be read.',
			);
		}

		if (!response.ok) {
			const message =
				payload.error?.message ?? 'OpenRouter rejected the request.';
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

		const choice = payload.choices?.[0];
		if (choice?.error?.message) {
			throw new LlmProviderError('PROVIDER_ERROR', choice.error.message);
		}

		const content = getMessageContent(choice?.message?.content);
		if (!content) {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'OpenRouter returned no comment variants.',
			);
		}

		const variants = parseContent(content);
		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			continue;
		}

		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'OpenRouter returned repetitive comment variants.',
	);
}
