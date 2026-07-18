import { useEffect, useState } from 'react';
import { clearHistory, deleteHistoryEntry, getHistory } from '../../lib/storage';
import type { HistoryEntry } from '../../lib/types';
import { Button } from '@/components/ui/button';

type InsertHistoryCommentResponse =
	| { ok: true }
	| { ok: false; message: string };

export default function HistoryTab() {
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [insertingText, setInsertingText] = useState<string | null>(null);
	const [status, setStatus] = useState('');

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

	const handleDelete = async (id: string) => {
		await deleteHistoryEntry(id);
		setHistory((prev) => prev.filter((item) => item.id !== id));
	};

	const handleClearAll = async () => {
		if (!window.confirm('Are you sure you want to clear all generation history?')) return;
		await clearHistory();
		setHistory([]);
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
					Generate comments on LinkedIn to see your recent drafts here!
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between pb-1">
				<span className="text-xs font-semibold text-muted-foreground tabular-nums">
					{history.length} {history.length === 1 ? 'generation' : 'generations'} saved
				</span>
				<Button
					type="button"
					variant="ghost"
					size="xs"
					onClick={handleClearAll}
					className="text-xs font-semibold text-destructive hover:text-destructive/80">
					Clear All
				</Button>
			</div>

			<div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
				{history.map((entry) => {
					const dateStr = new Date(entry.timestamp).toLocaleDateString(undefined, {
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit',
					});

					return (
						<div
							key={entry.id}
							className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-2">
							<div className="flex items-start justify-between gap-2 border-b border-border pb-2">
								<div>
									<div className="flex items-center gap-1.5">
										<span className="font-semibold text-xs text-card-foreground">
											{entry.authorName || 'LinkedIn Post'}
										</span>
										<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
											{entry.tone || 'variant'}
										</span>
									</div>
									<p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1 italic">
										"{entry.postText}"
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<span className="text-[10px] text-muted-foreground tabular-nums">{dateStr}</span>
									<button
										type="button"
										onClick={() => handleDelete(entry.id)}
										className="text-muted-foreground hover:text-destructive font-bold transition-[color]"
										title="Delete entry">
										×
									</button>
								</div>
							</div>

							<div className="space-y-1.5 pt-1">
								{entry.variants.map((v, i) => (
									<button
										key={i}
										type="button"
										onClick={() => handleInsert(v.text)}
										disabled={insertingText === v.text}
										className="group relative block w-full rounded-lg bg-muted p-2 text-left text-xs text-foreground transition-[background-color] hover:bg-accent disabled:cursor-wait disabled:opacity-70 active:scale-[0.96]">
										<p className="pr-12">{v.text}</p>
										<span className="absolute right-2 top-2 rounded bg-card px-1.5 py-0.5 text-[10px] font-semibold text-primary shadow-sm border border-border opacity-80 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground transition-[opacity,background-color,color]">
											{insertingText === v.text ? 'Inserting…' : 'Insert'}
										</span>
									</button>
								))}
							</div>
						</div>
					);
				})}
			</div>
			{status ? (
				<p className="pt-1 text-xs text-muted-foreground">{status}</p>
			) : null}
		</div>
	);
}
