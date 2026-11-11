import {
	extractPostTimestampFromUrn,
	extractUsernameFromUrl,
	parseRelativeTimeToMs,
} from './text-utils';
import type { HistoryEntry } from './types';

/**
 * Normalizes text to a single clean line without breaking spreadsheet rows.
 * Replaces newlines, carriage returns, tabs, and multiple spaces with a single space.
 */
export function formatSingleLine(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value)
		.replace(/[\r\n\t]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Escapes a single field value for RFC 4180 compliant CSV output.
 * Ensures the value is strictly single-line so spreadsheet rows don't explode vertically.
 */
export function escapeCsvField(value: unknown): string {
	const singleLine = formatSingleLine(value);
	const escaped = singleLine.replace(/"/g, '""');
	return `"${escaped}"`;
}

/**
 * Resolves post date and time from stored postDate, postTimestamp, or Snowflake URN.
 */
export function resolvePostDateTime(entry: HistoryEntry): {
	postDate: string;
	postTime: string;
} {
	// 1. Direct postTimestamp
	let ts = entry.postTimestamp;

	// 2. Extract from postUrn, postUrl, or id
	if (!ts) {
		ts =
			extractPostTimestampFromUrn(entry.postUrn) ||
			extractPostTimestampFromUrn(entry.postUrl) ||
			extractPostTimestampFromUrn(entry.id);
	}

	if (ts) {
		const d = new Date(ts);
		if (!isNaN(d.getTime())) {
			return {
				postDate: d.toISOString().split('T')[0],
				postTime: d.toTimeString().split(' ')[0],
			};
		}
	}

	// 3. Fallback to entry.postDate string if available
	if (entry.postDate) {
		const approxMs = parseRelativeTimeToMs(entry.postDate, entry.timestamp);
		if (approxMs) {
			const d = new Date(approxMs);
			if (!isNaN(d.getTime())) {
				return {
					postDate: d.toISOString().split('T')[0],
					postTime: d.toTimeString().split(' ')[0],
				};
			}
		}
		return {
			postDate: entry.postDate,
			postTime: '—',
		};
	}

	// 4. Graceful fallback for legacy drafts created before postDate tracking:
	// Use generation date & time so the CSV never shows blank or "Unavailable"
	const genDate = new Date(entry.timestamp);
	if (!isNaN(genDate.getTime())) {
		return {
			postDate: genDate.toISOString().split('T')[0],
			postTime: genDate.toTimeString().split(' ')[0],
		};
	}

	return {
		postDate: 'Unavailable',
		postTime: 'Unavailable',
	};
}

/**
 * Converts an array of HistoryEntry objects into a clean, professional RFC 4180 CSV string.
 * Columns: ID, Username, Post Content, Post Date, Post Time, Generation Date, Generation Time, Provider, Model, Variant 1, Variant 2, Variant 3
 */
export function historyToCsv(entries: HistoryEntry[]): string {
	const headers = [
		'ID',
		'Username',
		'Post Content',
		'Post Date',
		'Post Time',
		'Generation Date',
		'Generation Time',
		'Provider',
		'Model',
		'Variant 1',
		'Variant 2',
		'Variant 3',
	];

	const rows = entries.map((entry) => {
		const postDt = resolvePostDateTime(entry);

		const genDateObj = new Date(entry.timestamp);
		const isGenValid = !isNaN(genDateObj.getTime());
		const genDateStr = isGenValid ? genDateObj.toISOString().split('T')[0] : '';
		const genTimeStr = isGenValid ? genDateObj.toTimeString().split(' ')[0] : '';

		const username =
			entry.authorName ||
			extractUsernameFromUrl(entry.postUrl) ||
			'Unavailable';

		const v1 = entry.variants[0]?.text || '';
		const v2 = entry.variants[1]?.text || '';
		const v3 = entry.variants[2]?.text || '';

		return [
			escapeCsvField(entry.id),
			escapeCsvField(username),
			escapeCsvField(entry.postText || ''),
			escapeCsvField(postDt.postDate),
			escapeCsvField(postDt.postTime),
			escapeCsvField(genDateStr),
			escapeCsvField(genTimeStr),
			escapeCsvField(entry.provider || ''),
			escapeCsvField(entry.model || ''),
			escapeCsvField(v1),
			escapeCsvField(v2),
			escapeCsvField(v3),
		].join(',');
	});

	return [headers.map(escapeCsvField).join(','), ...rows].join('\r\n');
}

/**
 * Triggers a client-side download of a CSV file.
 */
export function downloadCsv(
	csvContent: string,
	filename = `linkedin-comments-history-${new Date().toISOString().split('T')[0]}.csv`,
): void {
	const blob = new Blob(['\uFEFF' + csvContent], {
		type: 'text/csv;charset=utf-8;',
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.setAttribute('download', filename);
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
