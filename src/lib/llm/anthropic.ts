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

function validateVariants(value: unknown): CommentVariant[] {
	if (!Array.isArray(value) || value.length !== 3) {
		throw new LlmProviderError(
			'INVALID_RESPONSE',
			'Anthropic returned an unexpected response shape.',
		);
	}

	const variants = value.map((item) => {
		if (!item || typeof item !== 'object') {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Anthropic returned an invalid comment variant.',
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
				'Anthropic returned an invalid comment variant.',
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
			'Anthropic did not return all three requested tones.',
		);
	}

	return variants;
}

function inferCongratulation(text: string): boolean {
	return /\b(congrats?|congratulat(e|ions|ing)|well done|proud of you|happy for you|celebrat(e|ion|ing))\b/i.test(
		text,
	);
}

function parseContent(content: string): CommentVariant[] {
	const normalized = content
		.trim()
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

	// Fallback: labelled text parsing
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

	if (labelledVariants.length === 3) return validateVariants(labelledVariants);

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'Anthropic returned a response that could not be parsed.',
	);
}

function parseRetryAfter(response: Response): number | undefined {
	const value = response.headers.get('retry-after');
	if (!value) return undefined;
	const seconds = Number(value);
	return Number.isFinite(seconds) ? seconds : undefined;
}

export async function generateWithAnthropic(
	request: CommentRequest,
	settings: UserSettings,
	history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
	const model = settings.model || 'claude-sonnet-4-20250514';
	const endpoint = 'https://api.anthropic.com/v1/messages';

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const prompt = buildCommentPrompt(request, settings, history, attempt);

		let response: Response;
		try {
			response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': settings.apiKeys.anthropic ?? '',
					'anthropic-version': '2023-06-01',
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
			});
		} catch {
			throw new LlmProviderError(
				'NETWORK_ERROR',
				'Could not reach Anthropic. Check your connection and try again.',
			);
		}

		let payload: AnthropicResponse;
		try {
			payload = (await response.json()) as AnthropicResponse;
		} catch {
			throw new LlmProviderError(
				'INVALID_RESPONSE',
				'Anthropic returned a response that could not be read.',
			);
		}

		if (!response.ok) {
			const message =
				payload.error?.message ?? 'Anthropic rejected the request.';
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

		const variants = parseContent(rawText);
		if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
			continue;
		}

		return variants;
	}

	throw new LlmProviderError(
		'INVALID_RESPONSE',
		'Anthropic returned repetitive comment variants.',
	);
}
