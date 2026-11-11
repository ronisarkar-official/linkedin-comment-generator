import { describe, expect, it } from 'vitest';
import {
	escapeCsvField,
	formatSingleLine,
	historyToCsv,
	resolvePostDateTime,
} from '../src/lib/csv-export';
import type { HistoryEntry } from '../src/lib/types';

describe('CSV Export Engine', () => {
	describe('formatSingleLine and escapeCsvField', () => {
		it('wraps strings in double quotes', () => {
			expect(escapeCsvField('hello world')).toBe('"hello world"');
		});

		it('escapes internal quotes by doubling them', () => {
			expect(escapeCsvField('Say "hello" now')).toBe('"Say ""hello"" now"');
		});

		it('normalizes newlines, tabs, and excess spaces to a single clean line', () => {
			expect(formatSingleLine('line 1\n\nline 2\r\nline 3\tline 4')).toBe(
				'line 1 line 2 line 3 line 4',
			);
			expect(escapeCsvField('line 1\n\nline 2')).toBe('"line 1 line 2"');
		});

		it('handles undefined and null gracefully', () => {
			expect(escapeCsvField(undefined)).toBe('""');
			expect(escapeCsvField(null)).toBe('""');
		});
	});

	describe('resolvePostDateTime', () => {
		it('extracts exact timestamp from LinkedIn Snowflake URN', () => {
			const entry: HistoryEntry = {
				id: '1',
				postText: 'test',
				postUrn: 'urn:li:activity:7260589624536768512',
				variants: [],
				timestamp: Date.now(),
			};
			const res = resolvePostDateTime(entry);
			expect(res.postDate).toBe('2024-11-08');
			expect(res.postTime).toBeDefined();
		});

		it('calculates date from stored relative postDate string if URN is missing', () => {
			const now = new Date('2026-03-15T12:00:00Z').getTime();
			const entry: HistoryEntry = {
				id: '2',
				postText: 'test',
				postDate: '2h ago',
				variants: [],
				timestamp: now,
			};
			const res = resolvePostDateTime(entry);
			expect(res.postDate).toBe('2026-03-15');
			expect(res.postTime).toBeDefined();
		});

		it('falls back to generation date when post date was not captured (legacy entries)', () => {
			const entry: HistoryEntry = {
				id: 'legacy-1',
				postText: 'older post',
				variants: [],
				timestamp: new Date('2026-03-10T14:30:00Z').getTime(),
			};
			const res = resolvePostDateTime(entry);
			expect(res.postDate).toBe('2026-03-10');
			expect(res.postTime).toBeDefined();
		});
	});

	describe('historyToCsv', () => {
		const sampleHistory: HistoryEntry[] = [
			{
				id: 'hist-1',
				postText: 'Building great developer tools\n\nrequires empathy, fast iteration, and dogfooding.',
				authorName: 'Roni Sarkar',
				postUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:7260589624536768512/',
				postUrn: 'urn:li:activity:7260589624536768512',
				postDate: '2h ago',
				provider: 'gemini',
				model: 'gemini-2.5-flash',
				tone: 'professional',
				length: 'medium',
				variants: [
					{ tone: 'professional', text: 'Fast iteration loops\nare definitely key.', congratulation: false },
					{ tone: 'witty', text: 'Dogfooding: praised in tech.', congratulation: false },
					{ tone: 'supportive', text: 'Love the focus on empathy.', congratulation: false },
				],
				timestamp: new Date('2026-03-15T10:30:00Z').getTime(),
			},
		];

		it('generates the exact requested professional CSV headers with both post and gen dates', () => {
			const csv = historyToCsv(sampleHistory);
			const firstLine = csv.split('\r\n')[0];
			expect(firstLine).toBe(
				'"ID","Username","Post Content","Post Date","Post Time","Generation Date","Generation Time","Provider","Model","Variant 1","Variant 2","Variant 3"',
			);
		});

		it('correctly formats rows with both post date and generation date', () => {
			const csv = historyToCsv(sampleHistory);
			const rows = csv.split('\r\n');
			expect(rows.length).toBe(2); // Header + 1 row
			const dataRow = rows[1];

			expect(dataRow).toContain('"hist-1"');
			expect(dataRow).toContain('"Roni Sarkar"');
			// Multi-line post content collapsed to a single line
			expect(dataRow).toContain('"Building great developer tools requires empathy, fast iteration, and dogfooding."');
			// Post date from Snowflake ID
			expect(dataRow).toContain('"2024-11-08"');
			// Generation date
			expect(dataRow).toContain('"2026-03-15"');
			expect(dataRow).toContain('"gemini"');
			expect(dataRow).toContain('"gemini-2.5-flash"');
			expect(dataRow).toContain('"Fast iteration loops are definitely key."');
			expect(dataRow).toContain('"Dogfooding: praised in tech."');
			expect(dataRow).toContain('"Love the focus on empathy."');
		});

		it('falls back to URL handle when authorName is missing', () => {
			const minimalHistory: HistoryEntry[] = [
				{
					id: 'hist-min',
					postText: 'Short post\nwith extra lines',
					postUrl: 'https://www.linkedin.com/in/satyanadella/',
					variants: [{ tone: 'witty', text: 'Quick reaction', congratulation: false }],
					timestamp: Date.now(),
				},
			];
			const csv = historyToCsv(minimalHistory);
			expect(csv).toContain('"satyanadella"');
			expect(csv).toContain('"Short post with extra lines"');
			expect(csv).toContain('"Quick reaction"');
		});
	});
});
