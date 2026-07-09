import type { CommentRequest, CommentVariant, HistoryEntry } from '../types';
import { normalizeText, similarity } from '../text-utils';

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