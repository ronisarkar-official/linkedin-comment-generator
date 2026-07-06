import type { CommentRequest, CommentVariant, HistoryEntry } from '../types';

const STOP_WORDS = new Set([
	'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are',
	'have', 'has', 'was', 'were', 'will', 'would', 'could', 'should', 'into',
	'about', 'post', 'comment', 'comments', 'just', 'very', 'really', 'more',
	'than', 'then', 'they', 'them', 'their', 'there', 'what', 'when', 'where',
	'who', 'why', 'how', 'our', 'out', 'not', 'too', 'can', 'may', 'might',
]);

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenize(value: string): Set<string> {
	return new Set(
		normalizeText(value)
			.split(' ')
			.filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
	);
}

function similarity(left: string, right: string): number {
	const leftTokens = tokenize(left);
	const rightTokens = tokenize(right);
	if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
	let overlap = 0;
	for (const token of leftTokens) {
		if (rightTokens.has(token)) overlap += 1;
	}
	return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function sameOpening(left: string, right: string): boolean {
	const leftWords = normalizeText(left).split(' ').slice(0, 8).join(' ');
	const rightWords = normalizeText(right).split(' ').slice(0, 8).join(' ');
	return leftWords.length > 0 && leftWords === rightWords;
}

function isNearDuplicate(left: string, right: string): boolean {
	return sameOpening(left, right) || similarity(left, right) >= 0.72;
}

function relevantHistoryEntries(
	request: CommentRequest,
	history: HistoryEntry[],
): HistoryEntry[] {
	return history.filter(
		(entry) => similarity(request.postText, entry.postText) >= 0.3,
	);
}

export function needsFreshnessRetry(
	request: CommentRequest,
	variants: CommentVariant[],
	history: HistoryEntry[],
): boolean {
	for (let index = 0; index < variants.length; index += 1) {
		for (let other = index + 1; other < variants.length; other += 1) {
			if (isNearDuplicate(variants[index].text, variants[other].text)) {
				return true;
			}
		}
	}

	const recentHistory = relevantHistoryEntries(request, history).flatMap((entry) =>
		entry.variants,
	);

	return variants.some((variant) =>
		recentHistory.some((historyVariant) => isNearDuplicate(variant.text, historyVariant.text)),
	);
}