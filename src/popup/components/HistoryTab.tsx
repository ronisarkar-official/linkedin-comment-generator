import { useEffect, useMemo, useState } from 'react';
import {
	Check,
	Copy,
	Download,
	ExternalLink,
	Search,
	Trash2,
	X,
} from 'lucide-react';
import { clearHistory, deleteHistoryEntry, getHistory } from '../../lib/storage';
import { downloadCsv, historyToCsv } from '../../lib/csv-export';
import { extractPostTimestampFromUrn, extractUsernameFromUrl } from '../../lib/text-utils';
import type { HistoryEntry } from '../../lib/types';
import { Button } from '@/components/ui/button';

type InsertHistoryCommentResponse =
	| { ok: true }
	| { ok: false; message: string };

type DateFilter = 'all' | 'today' | '7days' | '30days';

export default function HistoryTab() {
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState('');
	const [dateFilter, setDateFilter] = useState<DateFilter>('all');
	const [copiedText, setCopiedText] = useState<string | null>(null);
	const [insertingText, setInsertingText] = useState<string | null>(null);
	const [status, setStatus] = useState('');
	const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

	const toggleExpandPost = (id: string) => {
		setExpandedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	const loadHistory = () => {
		setLoading(true);
		void getHistory()
			.then(setHistory)
			.finally(() => setLoading(false));
	};

	useEffect(() => {
		loadHistory();
		const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
			if (changes.history) loadHistory();
		};
		chrome.storage.onChanged.addListener(listener);
		return () => chrome.storage.onChanged.removeListener(listener);
	}, []);

	const filteredHistory = useMemo(() => {
		const now = Date.now();
		const query = searchQuery.trim().toLowerCase();

		return history.filter((entry) => {
			// 1. Date filter
			if (dateFilter === 'today' && now - entry.timestamp > 24 * 60 * 60 * 1000) {
				return false;
			}
			if (dateFilter === '7days' && now - entry.timestamp > 7 * 24 * 60 * 60 * 1000) {
				return false;
			}
			if (dateFilter === '30days' && now - entry.timestamp > 30 * 24 * 60 * 60 * 1000) {
				return false;
			}

			// 2. Search query filter
			if (!query) return true;

			const displayAuthor =
				entry.authorName ||
				extractUsernameFromUrl(entry.postUrl) ||
				'LinkedIn User';
			const matchAuthor = displayAuthor.toLowerCase().includes(query);
			const matchPost = entry.postText.toLowerCase().includes(query);
			const matchTone = entry.tone?.toLowerCase().includes(query) ?? false;
			const matchProvider = entry.provider?.toLowerCase().includes(query) ?? false;
			const matchModel = entry.model?.toLowerCase().includes(query) ?? false;
			const matchVariants = entry.variants.some((v) =>
				v.text.toLowerCase().includes(query),
			);

			return matchAuthor || matchPost || matchTone || matchProvider || matchModel || matchVariants;
		});
	}, [history, searchQuery, dateFilter]);

	const handleDelete = async (id: string) => {
		await deleteHistoryEntry(id);
		setHistory((prev) => prev.filter((item) => item.id !== id));
	};

	const handleClearAll = async () => {
		if (!window.confirm('Are you sure you want to clear all generation history?')) return;
		await clearHistory();
		setHistory([]);
		setStatus('History cleared.');
	};

	const handleExportCsv = () => {
		const targetEntries = filteredHistory.length > 0 ? filteredHistory : history;
		if (targetEntries.length === 0) return;
		const csv = historyToCsv(targetEntries);
		downloadCsv(csv);
		setStatus(`Exported ${targetEntries.length} entries to CSV.`);
	};

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setCopiedText(text);
			setTimeout(() => setCopiedText(null), 2000);
		} catch {
			setStatus('Could not copy to clipboard.');
		}
	};

	const handleInsert = async (text: string) => {
		setInsertingText(text);
		setStatus('');

		try {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			const tabId = tab?.id;
			if (!tabId) {
				throw new Error('Could not find the active LinkedIn tab.');
			}

			const response = await new Promise<InsertHistoryCommentResponse>((resolve, reject) => {
				chrome.tabs.sendMessage(
					tabId,
					{
						action: 'INSERT_HISTORY_COMMENT',
						payload: { text },
					},
					(message: InsertHistoryCommentResponse | undefined) => {
						const runtimeError = chrome.runtime.lastError;
						if (runtimeError) {
							reject(new Error(runtimeError.message));
							return;
						}
						if (!message) {
							reject(new Error('The LinkedIn page did not respond.'));
							return;
						}
						resolve(message);
					},
				);
			});

			if (!response.ok) {
				throw new Error(response.message);
			}

			setStatus('Inserted into the LinkedIn comment box.');
		} catch (error) {
			setStatus(error instanceof Error ? error.message : 'Could not insert the comment.');
		} finally {
			setInsertingText(null);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
				<span className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
				Loading history…
			</div>
		);
	}

	if (history.length === 0) {
		return (
			<div className="py-12 text-center">
				<p className="text-sm font-medium text-foreground">No comment history yet.</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Generate comments on LinkedIn to see your drafts and analytics here!
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Search input bar */}
			<div className="relative">
				<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search author, post, or comment text..."
					className="w-full rounded-lg border border-input bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				{searchQuery ? (
					<button
						type="button"
						onClick={() => setSearchQuery('')}
						className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
						<X className="h-3.5 w-3.5" />
					</button>
				) : null}
			</div>

			{/* Date filter pills and actions */}
			<div className="flex items-center justify-between gap-1.5">
				<div className="inline-flex items-center rounded-lg bg-muted p-0.5 shrink-0">
					{(
						[
							{ id: 'all', label: 'All' },
							{ id: 'today', label: 'Today' },
							{ id: '7days', label: '7 Days' },
							{ id: '30days', label: '30 Days' },
						] as const
					).map((chip) => (
						<button
							key={chip.id}
							type="button"
							onClick={() => setDateFilter(chip.id)}
							className={`whitespace-nowrap shrink-0 rounded-md px-2 py-1 text-[10px] font-medium leading-none transition-colors ${
								dateFilter === chip.id
									? 'bg-background text-foreground shadow-2xs font-semibold'
									: 'text-muted-foreground hover:text-foreground'
							}`}>
							{chip.label}
						</button>
					))}
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={handleExportCsv}
						title="Export to CSV"
						className="h-6.5 gap-1 px-2 text-[10px] font-medium whitespace-nowrap shrink-0">
						<Download className="h-3 w-3" />
						Export CSV
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="xs"
						onClick={handleClearAll}
						title="Clear all history"
						className="h-6.5 w-6.5 p-0 text-[10px] text-destructive hover:text-destructive shrink-0">
						<Trash2 className="h-3 w-3" />
					</Button>
				</div>
			</div>

			{/* Header count badge */}
			<div className="flex items-center justify-between px-0.5 text-[10px] text-muted-foreground font-medium">
				<span>
					Showing {filteredHistory.length} of {history.length} {history.length === 1 ? 'draft' : 'drafts'}
				</span>
				{status ? <span className="text-primary truncate max-w-[200px]">{status}</span> : null}
			</div>

			{/* History cards list */}
			{filteredHistory.length === 0 ? (
				<div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
					No comments match your search criteria.
				</div>
			) : (
				<div className="space-y-2.5">
					{filteredHistory.map((entry) => {
						const dateStr = new Date(entry.timestamp).toLocaleDateString(undefined, {
							month: 'short',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit',
						});

						const resolvedPostTs =
							entry.postTimestamp ||
							extractPostTimestampFromUrn(entry.postUrn) ||
							extractPostTimestampFromUrn(entry.postUrl);

						const postDateFormatted = resolvedPostTs
							? new Date(resolvedPostTs).toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric',
								})
							: entry.postDate;

						return (
							<div
								key={entry.id}
								className="rounded-xl border border-border bg-card p-3 shadow-xs space-y-2 text-xs">
								{/* Card header */}
								<div className="flex items-start justify-between gap-2 border-b border-border pb-2">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5 flex-wrap">
											{(() => {
												const displayAuthor =
													entry.authorName ||
													extractUsernameFromUrl(entry.postUrl) ||
													'LinkedIn User';
												return (
													<span
														className="font-semibold text-xs text-card-foreground truncate max-w-[150px]"
														title={displayAuthor}>
														{displayAuthor}
													</span>
												);
											})()}
											{entry.tone ? (
												<span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground uppercase">
													{entry.tone}
												</span>
											) : null}
											{entry.provider ? (
												<span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-medium text-primary">
													{entry.provider}
												</span>
											) : null}
										</div>
										<div className="mt-1">
											<p
												className={`text-[11px] text-muted-foreground italic leading-relaxed ${
													expandedPosts[entry.id] ? '' : 'line-clamp-2'
												}`}>
												"{entry.postText}"
											</p>
											{entry.postText && entry.postText.length > 110 ? (
												<button
													type="button"
													onClick={() => toggleExpandPost(entry.id)}
													className="mt-0.5 text-[10px] font-medium text-primary hover:underline cursor-pointer">
													{expandedPosts[entry.id] ? 'Show less' : 'Show more'}
												</button>
											) : null}
										</div>
									</div>

									<div className="flex flex-col items-end gap-0.5 shrink-0 text-muted-foreground">
										<div className="flex items-center gap-1">
											<span
												className="text-[10px] tabular-nums font-medium"
												title={`Comment generated at: ${dateStr}`}>
												Gen: {dateStr}
											</span>
											{entry.postUrl ? (
												<a
													href={entry.postUrl}
													target="_blank"
													rel="noopener noreferrer"
													title="Open original post on LinkedIn"
													className="rounded p-1 hover:bg-muted hover:text-primary transition-colors">
													<ExternalLink className="h-3 w-3" />
												</a>
											) : null}
											<button
												type="button"
												onClick={() => handleDelete(entry.id)}
												className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
												title="Delete entry">
												<X className="h-3 w-3" />
											</button>
										</div>
										{postDateFormatted ? (
											<span
												className="text-[9px] text-muted-foreground/80 font-medium tabular-nums"
												title="LinkedIn post published date">
												Posted: {postDateFormatted}
											</span>
										) : null}
									</div>
								</div>

								{/* Variants list */}
								<div className="space-y-1.5 pt-0.5">
									{entry.variants.map((v, i) => {
										const isCopied = copiedText === v.text;
										const isInserting = insertingText === v.text;

										return (
											<div
												key={i}
												className="group relative rounded-lg bg-muted/60 p-2 text-left text-xs text-foreground transition-colors hover:bg-muted">
												<p className="pr-20 text-[11px] leading-relaxed select-text">{v.text}</p>
												<div className="absolute right-1.5 top-1.5 flex items-center gap-1 opacity-90 group-hover:opacity-100">
													<button
														type="button"
														onClick={() => handleCopy(v.text)}
														title="Copy to clipboard"
														className="rounded border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium text-foreground shadow-2xs hover:bg-accent transition-colors flex items-center gap-0.5">
														{isCopied ? (
															<>
																<Check className="h-2.5 w-2.5 text-green-600" />
																<span className="text-green-600">Copied</span>
															</>
														) : (
															<>
																<Copy className="h-2.5 w-2.5 text-muted-foreground" />
																<span>Copy</span>
															</>
														)}
													</button>
													<button
														type="button"
														onClick={() => handleInsert(v.text)}
														disabled={isInserting}
														title="Insert into active LinkedIn comment box"
														className="rounded border border-primary bg-primary px-1.5 py-0.5 text-[9px] font-medium text-primary-foreground shadow-2xs hover:bg-primary/90 transition-colors disabled:opacity-50">
														{isInserting ? 'Inserting…' : 'Insert'}
													</button>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
