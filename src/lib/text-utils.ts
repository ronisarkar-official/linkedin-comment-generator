const STOP_WORDS = new Set([
	'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are',
	'have', 'has', 'was', 'were', 'will', 'would', 'could', 'should', 'into',
	'about', 'post', 'comment', 'comments', 'just', 'very', 'really', 'more',
	'than', 'then', 'they', 'them', 'their', 'there', 'what', 'when', 'where',
	'who', 'why', 'how', 'our', 'out', 'not', 'too', 'can', 'may', 'might',
]);

export function normalizeText(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function tokenize(value: string): Set<string> {
	return new Set(
		normalizeText(value)
			.split(' ')
			.filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
	);
}

export function similarity(left: string, right: string): number {
	const leftTokens = tokenize(left);
	const rightTokens = tokenize(right);
	if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
	let overlap = 0;
	for (const token of leftTokens) {
		if (rightTokens.has(token)) overlap += 1;
	}
	return overlap / Math.max(leftTokens.size, rightTokens.size);
}
