import { logger } from '../logger';
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
import { getProvider } from './registry';

const REQUEST_TIMEOUT_MS = 30_000;

interface ChatCompletionResponse {
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
	// Cohere v2 wraps response differently
	message?: {
		content?: Array<{ type?: string; text?: string }>;
	};
}

function validateVariants(value: unknown, providerLabel: string): CommentVariant[] {
	if (!Array.isArray(value) || value.length !== 3) {
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			`${providerLabel} returned an unexpected response shape.`,
		);
	}

	const variants = value.map((item) => {
		if (!item || typeof item !== 'object') {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				`${providerLabel} returned an invalid comment variant.`,
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
				`${providerLabel} returned an invalid comment variant.`,
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
			`${providerLabel} did not return all three requested tones.`,
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

function parseContent(content: string, providerLabel: string): CommentVariant[] {
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
				if (Array.isArray(parsed)) return validateVariants(parsed, providerLabel);
				if (parsed && typeof parsed === 'object') {
					const record = parsed as Record<string, unknown>;
					for (const key of ['variants', 'comments', 'data', 'result']) {
						if (Array.isArray(record[key]))
							return validateVariants(record[key], providerLabel);
					}
				}
			} catch {
				continue;
			}
		}
	}

	const labelledVariants: CommentVariant[] = [];
	const labelPattern =
		/(?:^|\n)\s*(?:\d+[.)]\s*)?([a-zA-Z0-9\s-_]{3,25})\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:\d+[.)]\s*)?(?:[a-zA-Z0-9\s-_]{3,25})\s*[:\-]|$)/gi;

	for (const match of normalized.matchAll(labelPattern)) {
		const text = match[2]
			.trim()
			.replace(/^['"]|['"]$/g, '')
			.replace(/^[-*]\s*/, '');
		if (text && match[1].trim()) {
			labelledVariants.push({
				tone: match[1].trim().toLowerCase() as Tone,
				text,
				congratulation: inferCongratulation(text),
			});
		}
	}

	if (labelledVariants.length === 3) return validateVariants(labelledVariants, providerLabel);

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		`${providerLabel} returned a response that could not be parsed.`,
	);
}

export async function generateWithOpenAICompat(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const providerConfig = getProvider(settings.provider);
	const providerLabel = providerConfig.label;
	const model = settings.model || providerConfig.models[0].id;
	const chatEndpoint = `${providerConfig.apiBase}/chat/completions`;
	const apiKey = settings.apiKeys[settings.provider] ?? '';

	// Security: validate the API base uses HTTPS before sending credentials
	if (!providerConfig.apiBase.startsWith('https://')) {
		throw new LlmProviderError(
			'PROVIDER_ERROR',
			`${providerLabel} API endpoint must use HTTPS.`,
		);
	}

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${apiKey}`,
	};

	// OpenRouter-specific header
	if (settings.provider === 'openrouter') {
		headers['X-OpenRouter-Title'] = 'LinkedIn Comment Generator';
	}

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		logger.info(`${providerLabel} request started.`, { model, attempt });

		// Build response_format based on provider capability
		let responseFormat: Record<string, unknown> | undefined;
		if (providerConfig.responseFormat === 'json_schema') {
			responseFormat = {
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
								tone: { type: 'string' },
								text: { type: 'string' },
								congratulation: { type: 'boolean' },
							},
						},
					},
				},
			};
		} else if (providerConfig.responseFormat === 'json_object') {
			responseFormat = { type: 'json_object' };
		}

		const body: Record<string, unknown> = {
			model,
			messages: [
				{ role: 'system', content: prompt.system },
				{ role: 'user', content: prompt.user },
			],
			temperature: attempt === 0 ? 0.72 : 0.82,
			top_p: 0.85,
			max_completion_tokens: 2_048,
		};

		if (responseFormat) {
			body.response_format = responseFormat;
		}

		let response: Response;
		try {
			response = await fetch(chatEndpoint, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});
		} catch (error) {
			clearTimeout(timeout);
			if (error instanceof DOMException && error.name === 'AbortError') {
				logger.error(`${providerLabel} request timed out.`, { model, attempt });
				throw new LlmProviderError(
					'NETWORK_ERROR',
					`${providerLabel} request timed out. Try again.`,
				);
			}
			logger.error(`${providerLabel} network error.`, { model, attempt });
			throw new LlmProviderError(
				'NETWORK_ERROR',
				`Could not reach ${providerLabel}. Check your connection and try again.`,
			);
		} finally {
			clearTimeout(timeout);
		}

		let payload: ChatCompletionResponse;
		try {
			payload = (await response.json()) as ChatCompletionResponse;
		} catch {
			logger.error(`${providerLabel} returned unparseable response.`, { model, status: response.status });
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				`${providerLabel} returned a response that could not be read.`,
			);
		}

		if (!response.ok) {
			const message =
				payload.error?.message ?? `${providerLabel} rejected the request.`;
			logger.warn(`${providerLabel} API error.`, { model, status: response.status, message });
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

		// Handle Cohere v2 response format (message.content instead of choices)
		let content: string;
		if (payload.message?.content) {
			content = getMessageContent(payload.message.content);
		} else {
			const choice = payload.choices?.[0];
			if (choice?.error?.message) {
				throw new LlmProviderError('PROVIDER_ERROR', choice.error.message);
			}
			content = getMessageContent(choice?.message?.content);
		}

		if (!content) {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				`${providerLabel} returned no comment variants.`,
			);
		}

		const variants = parseContent(content, providerLabel);
		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			logger.info(`${providerLabel} freshness retry triggered.`, { model });
			continue;
		}

		logger.info(`${providerLabel} request succeeded.`, { model, attempt });
		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		`${providerLabel} returned repetitive comment variants.`,
	);
}
