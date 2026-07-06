import { useEffect, useState } from 'react';
import type { LlmProvider } from '../../lib/types';

interface ApiKeyInputProps {
	value: string;
	provider: LlmProvider;
	onSave: (apiKey: string) => Promise<void>;
}

export default function ApiKeyInput({
	value,
	provider,
	onSave,
}: ApiKeyInputProps) {
	const [apiKey, setApiKey] = useState(value);
	const [visible, setVisible] = useState(false);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState('');
	const [isError, setIsError] = useState(false);

	useEffect(() => {
		setApiKey(value);
		setFeedback('');
		setIsError(false);
	}, [value, provider]);

	const handleSave = async () => {
		const normalized = apiKey.trim();
		const isValid =
			provider === 'openrouter' ?
				normalized.startsWith('sk-or-') && normalized.length >= 20
			:	normalized.length >= 20;

		if (!isValid) {
			setIsError(true);
			setFeedback(
				`Enter a valid ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} API key.`,
			);
			return;
		}

		setSaving(true);
		setFeedback('');
		try {
			await onSave(normalized);
			setIsError(false);
			setFeedback('API key saved locally.');
		} catch {
			setIsError(true);
			setFeedback('Could not save the API key.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<label
					className="text-sm font-semibold text-slate-800"
					htmlFor="api-key">
					{provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} API key
				</label>
				<span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
					Local only
				</span>
			</div>
			<div className="flex gap-2">
				<div className="relative min-w-0 flex-1">
					<input
						id="api-key"
						type={visible ? 'text' : 'password'}
						value={apiKey}
						onChange={(event) => {
							setApiKey(event.target.value);
							setFeedback('');
						}}
						placeholder={provider === 'openrouter' ? 'sk-or-v1-…' : 'AIza…'}
						autoComplete="off"
						spellCheck={false}
						className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 pr-14 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
					/>
					<button
						type="button"
						onClick={() => setVisible((current) => !current)}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
						{visible ? 'Hide' : 'Show'}
					</button>
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={saving}
					className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
			<p
				className={`min-h-4 text-xs ${isError ? 'text-red-600' : 'text-emerald-700'}`}
				role={isError ? 'alert' : 'status'}>
				{feedback}
			</p>
		</section>
	);
}
