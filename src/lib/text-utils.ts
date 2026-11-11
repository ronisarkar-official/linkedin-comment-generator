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

/**
 * Formats a generated comment with an optional user promotional message.
 *
 * Does not insert any paragraph break or newline by default — all spacing is left
 * entirely to the user's choice. Any leading newlines (Enter), tabs (Tab), or
 * spaces (Spacebar) entered in the promotional message box are preserved exactly as typed.
 */
export function formatCommentWithPromo(
	comment: string,
	promotionalMessage?: string,
): string {
	const baseComment = comment.trimEnd();
	if (!promotionalMessage || promotionalMessage.trim().length === 0) {
		return baseComment;
	}

	const promo = promotionalMessage.trimEnd();
	return `${baseComment}${promo}`;
}

/**
 * Cleans raw author/actor text extracted from LinkedIn DOM elements.
 * Removes screen-reader labels ("View ...'s profile"), connection degree markers ("• 1st", "• 2nd"),
 * action buttons ("Follow", "Connect"), timestamps ("• 2h", "• 1w"), pronouns, and avatar prefixes.
 */
export function cleanAuthorName(raw?: string | null): string | undefined {
	if (!raw) return undefined;

	// Split by newline and get first non-empty line
	const lines = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) return undefined;

	let text = lines[0];

	// Extract name from "View ...'s profile"
	const viewMatch = text.match(/^View\s+(.+?)['’]s\s+profile/i);
	if (viewMatch && viewMatch[1]) {
		text = viewMatch[1].trim();
	}

	// Remove trailing degree / connection / author markers
	// e.g. "John Doe • 1st", "Jane Smith • Following", "Acme Corp • Author"
	text = text.replace(
		/\s*•\s*(1st|2nd|3rd\+?|3rd|Following|Follow|Connect|You|Author|Promoted|Subscribed).*$/i,
		'',
	);

	// Remove trailing relative timestamps like "• 2h", "• 1w", "• Edited"
	text = text.replace(/\s*•\s*(\d+[smhdwy]|now|edited).*$/i, '');

	// Remove pronouns e.g. "(He/Him)", "(She/Her)", "(They/Them)"
	text = text.replace(
		/\s*\((?:He\/Him|She\/Her|They\/Them|He\/Him\/His|She\/Her\/Hers)\)/i,
		'',
	);

	// Remove image/avatar alt prefixes
	text = text.replace(/^(?:Photo|Image|Logo)\s+(?:of|for)\s+/i, '');
	text = text.replace(/^View\s+profile\s+(?:of\s+)?/i, '');

	text = text.trim();

	const IGNORED_NAMES = new Set([
		'linkedin',
		'linkedin post',
		'promoted',
		'suggested',
		'feed',
		'follow',
		'following',
		'connect',
		'1st',
		'2nd',
		'3rd',
	]);

	if (
		text.length < 2 ||
		text.length > 80 ||
		IGNORED_NAMES.has(text.toLowerCase())
	) {
		return undefined;
	}

	return text;
}

/**
 * Extracts a clean username or company handle from a LinkedIn URL.
 * Handles:
 * - Profile URLs: `/in/satyanadella/` -> `"satyanadella"`
 * - Company URLs: `/company/amazon/` -> `"amazon"`
 * - Post URLs with vanity slug: `/posts/satyanadella_ai-innovation...` -> `"satyanadella"`
 */
export function extractUsernameFromUrl(url?: string | null): string | undefined {
	if (!url) return undefined;
	try {
		const parsed = new URL(url, 'https://www.linkedin.com');
		const pathname = parsed.pathname;

		// 1. Post permalink with username slug: /posts/username_topic-activity-...
		const postSlugMatch = pathname.match(/\/posts\/([a-zA-Z0-9._-]+?)_/i);
		if (postSlugMatch && postSlugMatch[1]) {
			return postSlugMatch[1];
		}

		// 2. Profile URL: /in/username
		const inMatch = pathname.match(/\/in\/([^/?#]+)/i);
		if (inMatch && inMatch[1]) {
			const slug = decodeURIComponent(inMatch[1]).trim();
			if (slug && slug.toLowerCase() !== 'me') {
				return slug;
			}
		}

		// 3. Company URL: /company/handle
		const companyMatch = pathname.match(/\/company\/([^/?#]+)/i);
		if (companyMatch && companyMatch[1]) {
			const slug = decodeURIComponent(companyMatch[1]).trim();
			if (slug) {
				return slug;
			}
		}
	} catch {
		// ignore URL parse errors
	}
	return undefined;
}

/**
 * Extracts the exact creation timestamp (in milliseconds) from a LinkedIn 64-bit Snowflake activity ID.
 * LinkedIn activity IDs store Unix millisecond epoch in the high 42 bits (ID >> 22).
 */
export function extractPostTimestampFromUrn(urnOrUrl?: string | null): number | undefined {
	if (!urnOrUrl) return undefined;
	const match = urnOrUrl.match(/\d{15,22}/);
	if (!match) return undefined;

	try {
		const id = BigInt(match[0]);
		const epochMs = Number(id >> 22n);
		// Validate that the timestamp falls within a reasonable modern epoch (2018 - 2035)
		if (epochMs > 1514764800000 && epochMs < 2051222400000) {
			return epochMs;
		}
	} catch {
		// ignore BigInt parsing issues
	}
	return undefined;
}

/**
 * Cleans relative or human-readable post date text extracted from LinkedIn DOM elements.
 * e.g., "2h • Edited • " -> "2h", "3 days ago • " -> "3 days ago".
 */
export function cleanPostDateText(raw?: string | null): string | undefined {
	if (!raw) return undefined;

	let text = raw
		.split(/\r?\n/)[0]
		.replace(/•\s*(?:Edited|Public|Follow|Following|Author|Promoted).*$/i, '')
		.replace(/•.*$/i, '')
		.replace(/^(?:Edited|Public)\s*•?\s*/i, '')
		.trim();

	// Match relative patterns: 2h, 3d, 1w, 5m, 2 hours ago, just now, etc.
	const relativePattern =
		/^(\d+\s*(?:s|m|h|d|w|mo|y|sec|secs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|month|months|year|years)(?:\s+ago)?|just now|now|yesterday)$/i;
	if (relativePattern.test(text)) {
		return text;
	}

	// Match absolute date strings e.g. "Nov 8, 2024", "Nov 8", "8 Nov 2024"
	if (/^[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?$/.test(text)) {
		return text;
	}

	return text.length > 0 && text.length <= 40 ? text : undefined;
}

/**
 * Converts a relative LinkedIn time string (e.g. "2h", "3d", "1w") into an approximate epoch ms.
 */
export function parseRelativeTimeToMs(
	relativeStr?: string | null,
	referenceMs = Date.now(),
): number | undefined {
	if (!relativeStr) return undefined;
	const match = relativeStr
		.toLowerCase()
		.match(/(\d+)\s*([smhdw]|mo|y|sec|min|hour|day|week|month|year)/);
	if (!match) return undefined;

	const num = parseInt(match[1], 10);
	const unit = match[2];

	if (unit.startsWith('s') && !unit.startsWith('sec')) return referenceMs - num * 1000;
	if (unit.startsWith('sec')) return referenceMs - num * 1000;
	if (unit.startsWith('m') && !unit.startsWith('mo')) return referenceMs - num * 60 * 1000;
	if (unit.startsWith('h')) return referenceMs - num * 60 * 60 * 1000;
	if (unit.startsWith('d')) return referenceMs - num * 24 * 60 * 60 * 1000;
	if (unit.startsWith('w')) return referenceMs - num * 7 * 24 * 60 * 60 * 1000;
	if (unit === 'mo' || unit.startsWith('month')) return referenceMs - num * 30 * 24 * 60 * 60 * 1000;
	if (unit.startsWith('y')) return referenceMs - num * 365 * 24 * 60 * 60 * 1000;

	return undefined;
}

