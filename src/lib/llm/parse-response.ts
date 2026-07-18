import type { CommentVariant } from '../types';
import { LlmProviderError } from '../types';

/**
 * Validates that a parsed JSON value is an array of exactly 3 well-formed
 * CommentVariant objects with distinct tones.
 */
export function validateVariants(value: unknown, providerLabel: string): CommentVariant[] {
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
			tone: candidate.tone,
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

/**
 * Infers whether a comment text is congratulatory based on keyword matching.
 * Used as a fallback when the LLM doesn't return a `congratulation` boolean
 * in non-JSON response formats.
 */
export function inferCongratulation(text: string): boolean {
	return /\b(congrats?|congratulat(e|ions|ing)|well done|proud of you|happy for you|celebrat(e|ion|ing))\b/i.test(
		text,
	);
}

/**
 * Attempts to parse LLM response content into CommentVariant[].
 *
 * Handles multiple formats:
 * 1. Clean JSON array
 * 2. JSON wrapped in markdown code fences
 * 3. JSON with a wrapper object (keys: variants, comments, data, result)
 * 4. Trailing-comma-tolerant JSON
 * 5. DeepSeek-style <think> block removal
 * 6. Labelled text fallback (e.g. "Professional: ...")
 */
export function parseContent(content: string, providerLabel: string): CommentVariant[] {
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

	// Fallback: labelled text parsing (e.g. "Professional: The metric you cited...")
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
				tone: match[1].trim().toLowerCase(),
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
