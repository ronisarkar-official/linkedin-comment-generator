import type { CommentRequest, CommentVariant, HistoryEntry } from '../types';
import { normalizeText, similarity } from '../text-utils';

export const DEFAULT_DUPLICATE_THRESHOLD = 0.65;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checks if two comments share the same opening words (e.g. "I really like your point about").
 * Catches common repetitive AI openers even if the rest of the comment diverges.
 */
export function sameOpening(left: string, right: string, wordCount = 6): boolean {
	const leftWords = normalizeText(left).split(' ').filter(Boolean).slice(0, wordCount);
	const rightWords = normalizeText(right).split(' ').filter(Boolean).slice(0, wordCount);
	if (leftWords.length < 4 || rightWords.length < 4) return false;
	const minWords = Math.min(leftWords.length, rightWords.length);
	return leftWords.slice(0, minWords).join(' ') === rightWords.slice(0, minWords).join(' ');
}

/**
 * Checks if two comment texts are duplicates or near-duplicates based on
 * identical normalized text, identical opening phrases, or high token similarity.
 */
export function isNearDuplicate(
	left: string,
	right: string,
	threshold = DEFAULT_DUPLICATE_THRESHOLD,
): boolean {
	const normLeft = normalizeText(left);
	const normRight = normalizeText(right);
	if (!normLeft || !normRight) return false;
	if (normLeft === normRight) return true;
	if (sameOpening(left, right, 6)) return true;
	return similarity(left, right) >= threshold;
}

/**
 * Extracts unique comments generated within the last N days across ALL posts,
 * enabling cross-post anti-repetition protection.
 */
export function getRecentHistoryComments(
	history: HistoryEntry[],
	maxCount = 20,
	maxAgeMs = SEVEN_DAYS_MS,
): string[] {
	const now = Date.now();
	const comments: string[] = [];
	const seen = new Set<string>();

	for (const entry of history) {
		if (now - entry.timestamp > maxAgeMs) continue;
		for (const variant of entry.variants) {
			const text = variant.text.trim();
			const normalized = normalizeText(text);
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			comments.push(text);
			if (comments.length >= maxCount) return comments;
		}
	}
	return comments;
}

/**
 * Finds history entries generated for posts with similar content.
 */
export function relevantHistoryEntries(
	request: CommentRequest,
	history: HistoryEntry[],
): HistoryEntry[] {
	return history.filter(
		(entry) => similarity(request.postText, entry.postText) >= 0.25,
	);
}

/**
 * Combines topic-relevant past comments and recent cross-post comments into a single
 * anti-repetition pool to prevent echoing structures or phrasing across commenting sessions.
 */
export function getAntiRepetitionPool(
	request: CommentRequest,
	history: HistoryEntry[],
	maxCount = 25,
): string[] {
	const pool: string[] = [];
	const seen = new Set<string>();

	// 1. Topic-similar post comments take priority
	const similarEntries = relevantHistoryEntries(request, history);
	for (const entry of similarEntries) {
		for (const v of entry.variants) {
			const norm = normalizeText(v.text);
			if (norm && !seen.has(norm)) {
				seen.add(norm);
				pool.push(v.text.trim());
			}
		}
	}

	// 2. Recent comments across any post from the last 7 days
	const recent = getRecentHistoryComments(history, maxCount);
	for (const text of recent) {
		const norm = normalizeText(text);
		if (norm && !seen.has(norm)) {
			seen.add(norm);
			pool.push(text);
			if (pool.length >= maxCount) break;
		}
	}

	return pool;
}

/**
 * Determines whether generated variants need a freshness retry.
 * Returns true if:
 * 1. Any two variants in the current batch duplicate each other (intra-batch duplication).
 * 2. Any variant duplicates a recently generated comment across any post (cross-post duplication).
 */
export function needsFreshnessRetry(
	request: CommentRequest,
	variants: CommentVariant[],
	history: HistoryEntry[],
	threshold = DEFAULT_DUPLICATE_THRESHOLD,
): boolean {
	// 1. Check intra-batch duplicates
	for (let i = 0; i < variants.length; i += 1) {
		for (let j = i + 1; j < variants.length; j += 1) {
			if (isNearDuplicate(variants[i].text, variants[j].text, threshold)) {
				return true;
			}
		}
	}

	// 2. Check cross-post & recent history duplicates
	const antiRepetitionPool = getAntiRepetitionPool(request, history);
	return variants.some((variant) =>
		antiRepetitionPool.some((pastComment) => isNearDuplicate(variant.text, pastComment, threshold)),
	);
}

/**
 * Filters out duplicate variants from a batch, keeping only unique variants.
 */
export function deduplicateBatch(
	variants: CommentVariant[],
	threshold = DEFAULT_DUPLICATE_THRESHOLD,
): CommentVariant[] {
	const unique: CommentVariant[] = [];
	for (const variant of variants) {
		const isDupe = unique.some((existing) =>
			isNearDuplicate(variant.text, existing.text, threshold),
		);
		if (!isDupe) {
			unique.push(variant);
		}
	}
	return unique;
}
