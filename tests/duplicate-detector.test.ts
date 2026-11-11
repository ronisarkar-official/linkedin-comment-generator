import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DUPLICATE_THRESHOLD,
	deduplicateBatch,
	getAntiRepetitionPool,
	getRecentHistoryComments,
	isNearDuplicate,
	needsFreshnessRetry,
	relevantHistoryEntries,
	sameOpening,
} from '../src/lib/llm/freshness';
import type { CommentRequest, CommentVariant, HistoryEntry } from '../src/lib/types';

describe('Duplicate Detection & Anti-Repetition Engine', () => {
	const sampleRequest: CommentRequest = {
		postText: 'We analyzed cloud infrastructure spending across 500 startups and found that Kubernetes clusters are 40% over-provisioned.',
		authorName: 'Sarah Chen',
		tone: 'professional',
		length: 'medium',
	};

	describe('sameOpening', () => {
		it('detects comments sharing the same opening words', () => {
			const left = 'I really love the point about over-provisioned clusters in production.';
			const right = 'I really love the point about cost allocation across enterprise teams.';
			expect(sameOpening(left, right, 6)).toBe(true);
		});

		it('ignores case and punctuation in opening detection', () => {
			const left = 'The 2x price of Fable 5.2 really makes the switch difficult.';
			const right = 'the 2x price of fable 5.2 really makes budgeting hard!';
			expect(sameOpening(left, right, 6)).toBe(true);
		});

		it('returns false when openings diverge early', () => {
			const left = 'Over-provisioning is definitely a common issue for cloud teams.';
			const right = 'Cloud spending data here aligns with what we see in our audits.';
			expect(sameOpening(left, right, 6)).toBe(false);
		});

		it('returns false for very short comments under 4 words', () => {
			expect(sameOpening('Great job!', 'Great job here!')).toBe(false);
		});
	});

	describe('isNearDuplicate', () => {
		it('detects exact matches', () => {
			const text = 'Kubernetes autoscaling often fixes cluster over-provisioning.';
			expect(isNearDuplicate(text, text)).toBe(true);
		});

		it('detects near-duplicates with same opening phrase', () => {
			const left = 'The key takeaway for dev budgets is reducing idle capacity.';
			const right = 'The key takeaway for dev budgets is monitoring node sizes.';
			expect(isNearDuplicate(left, right)).toBe(true);
		});

		it('detects high lexical token similarity (>= 0.65)', () => {
			const left = 'Cloud clusters are frequently over-provisioned by 40 percent in early stage startups.';
			const right = 'Cloud clusters are often over-provisioned by 40 percent in modern startups.';
			expect(isNearDuplicate(left, right, DEFAULT_DUPLICATE_THRESHOLD)).toBe(true);
		});

		it('returns false for distinct comments on the same topic', () => {
			const left = 'Have you checked if Karpenter or similar node autoscalers close this 40% gap?';
			const right = 'Engineers rarely have incentives to rightsize instances until finance intervenes.';
			expect(isNearDuplicate(left, right, DEFAULT_DUPLICATE_THRESHOLD)).toBe(false);
		});
	});

	describe('getRecentHistoryComments (Cross-Post Retrieval)', () => {
		const now = Date.now();
		const history: HistoryEntry[] = [
			{
				id: 'entry-1',
				postText: 'Completely unrelated post about product management and sprint planning.',
				authorName: 'Alex Rivera',
				tone: 'witty',
				length: 'medium',
				variants: [
					{ tone: 'witty', text: 'Sprint planning without clear specs is just synchronized guessing.', congratulation: false },
					{ tone: 'professional', text: 'Clear acceptance criteria prevent sprint rollover every single cycle.', congratulation: false },
				],
				timestamp: now - 1000 * 60 * 60 * 2, // 2 hours ago
			},
			{
				id: 'entry-2',
				postText: 'Older post from 10 days ago about hiring.',
				authorName: 'Jordan Lee',
				tone: 'supportive',
				length: 'short',
				variants: [
					{ tone: 'supportive', text: 'Hiring great engineers takes patience and transparency.', congratulation: false },
				],
				timestamp: now - 1000 * 60 * 60 * 24 * 10, // 10 days ago (expired)
			},
		];

		it('extracts comments generated across any post within the last 7 days', () => {
			const comments = getRecentHistoryComments(history, 10);
			expect(comments).toContain('Sprint planning without clear specs is just synchronized guessing.');
			expect(comments).toContain('Clear acceptance criteria prevent sprint rollover every single cycle.');
			// Expired comment (> 7 days) should not be included
			expect(comments).not.toContain('Hiring great engineers takes patience and transparency.');
		});

		it('deduplicates identical comment variants in history', () => {
			const duplicateHistory: HistoryEntry[] = [
				{
					id: 'dupe-1',
					postText: 'Post A',
					tone: 'professional',
					length: 'short',
					variants: [{ tone: 'professional', text: 'Same exact comment text here.', congratulation: false }],
					timestamp: now - 1000,
				},
				{
					id: 'dupe-2',
					postText: 'Post B',
					tone: 'supportive',
					length: 'short',
					variants: [{ tone: 'supportive', text: 'Same exact comment text here.', congratulation: false }],
					timestamp: now - 2000,
				},
			];
			const comments = getRecentHistoryComments(duplicateHistory, 10);
			expect(comments.filter((c) => c === 'Same exact comment text here.').length).toBe(1);
		});
	});

	describe('getAntiRepetitionPool', () => {
		const now = Date.now();
		const history: HistoryEntry[] = [
			{
				id: 'topic-match',
				postText: 'Cloud infrastructure spending and Kubernetes cluster optimization.',
				authorName: 'DevOps Lead',
				tone: 'professional',
				length: 'medium',
				variants: [
					{ tone: 'professional', text: 'Right-sizing node pools shaved 30% off our monthly AWS bill.', congratulation: false },
				],
				timestamp: now - 1000 * 60 * 60, // 1 hour ago
			},
			{
				id: 'cross-post',
				postText: 'Excited to announce our new funding round!',
				authorName: 'Founder',
				tone: 'supportive',
				length: 'short',
				variants: [
					{ tone: 'supportive', text: 'Huge congrats on the milestone, looking forward to what you build next!', congratulation: true },
				],
				timestamp: now - 1000 * 60 * 120, // 2 hours ago
			},
		];

		it('combines topic-similar comments and cross-post comments into the anti-repetition pool', () => {
			const pool = getAntiRepetitionPool(sampleRequest, history, 10);
			expect(pool).toContain('Right-sizing node pools shaved 30% off our monthly AWS bill.');
			expect(pool).toContain('Huge congrats on the milestone, looking forward to what you build next!');
		});
	});

	describe('needsFreshnessRetry', () => {
		const distinctVariants: CommentVariant[] = [
			{ tone: 'professional', text: 'Over-provisioning often stems from sizing for peak traffic without dynamic horizontal pod autoscalers.', congratulation: false },
			{ tone: 'witty', text: 'Nothing quite like paying AWS for CPU cycles that spend all weekend napping.', congratulation: false },
			{ tone: 'supportive', text: 'These 500 startup benchmarks provide great ammunition for engineering teams justifying tooling investments.', congratulation: false },
		];

		it('returns false when all variants are unique and distinct from history', () => {
			expect(needsFreshnessRetry(sampleRequest, distinctVariants, [])).toBe(false);
		});

		it('detects intra-batch duplicates (two variants sharing same opening)', () => {
			const intraBatchDupe: CommentVariant[] = [
				{ tone: 'professional', text: 'The key takeaway for dev budgets is reducing idle capacity in clusters.', congratulation: false },
				{ tone: 'witty', text: 'The key takeaway for dev budgets is setting up automated alerts.', congratulation: false },
				{ tone: 'supportive', text: 'Great benchmark data for engineering leads.', congratulation: false },
			];
			expect(needsFreshnessRetry(sampleRequest, intraBatchDupe, [])).toBe(true);
		});

		it('detects intra-batch duplicates (high token similarity)', () => {
			const highSimilarityBatch: CommentVariant[] = [
				{ tone: 'professional', text: 'Kubernetes cluster over-provisioning wastes 40% of cloud spend in startups.', congratulation: false },
				{ tone: 'witty', text: 'Kubernetes cluster over-provisioning wastes 40% of cloud spending across startups.', congratulation: false },
				{ tone: 'supportive', text: 'Useful data to share with finance teams.', congratulation: false },
			];
			expect(needsFreshnessRetry(sampleRequest, highSimilarityBatch, [])).toBe(true);
		});

		it('detects cross-post duplicates against past comments on different posts', () => {
			const pastHistory: HistoryEntry[] = [
				{
					id: 'old-post',
					postText: 'Completely different topic about database tuning and postgres indexing.',
					authorName: 'DB Admin',
					tone: 'professional',
					length: 'medium',
					variants: [
						{ tone: 'professional', text: 'The 2x price really makes the question key for dev budgets.', congratulation: false },
					],
					timestamp: Date.now() - 1000 * 60 * 60, // 1 hr ago
				},
			];

			// New candidate repeats the exact same sentence structure on a new post
			const candidateWithCrossPostDupe: CommentVariant[] = [
				{ tone: 'professional', text: 'The 2x price really makes the question key for dev budgets.', congratulation: false },
				{ tone: 'witty', text: 'Another perspective on cloud costs.', congratulation: false },
				{ tone: 'supportive', text: 'Helpful benchmarks.', congratulation: false },
			];

			expect(needsFreshnessRetry(sampleRequest, candidateWithCrossPostDupe, pastHistory)).toBe(true);
		});
	});

	describe('deduplicateBatch', () => {
		it('preserves distinct variants unchanged', () => {
			const variants: CommentVariant[] = [
				{ tone: 'professional', text: 'A completely unique professional insight.', congratulation: false },
				{ tone: 'witty', text: 'A different witty joke.', congratulation: false },
			];
			expect(deduplicateBatch(variants)).toHaveLength(2);
		});

		it('filters out redundant variants in a batch', () => {
			const variants: CommentVariant[] = [
				{ tone: 'professional', text: 'The key takeaway for dev budgets is reducing idle capacity in clusters.', congratulation: false },
				{ tone: 'witty', text: 'The key takeaway for dev budgets is reducing idle capacity in clusters.', congratulation: false },
				{ tone: 'supportive', text: 'A truly different perspective on team metrics.', congratulation: false },
			];
			const deduped = deduplicateBatch(variants);
			expect(deduped).toHaveLength(2);
			expect(deduped[0].tone).toBe('professional');
			expect(deduped[1].tone).toBe('supportive');
		});
	});
});

