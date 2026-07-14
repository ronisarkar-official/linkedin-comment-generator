import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface ApiKeyInputProps {
	value: string;
	providerLabel: string;
	placeholder: string;
	keyPrefix?: string;
	onSave: (apiKey: string) => Promise<void>;
}

export default function ApiKeyInput({
	value,
	providerLabel,
	placeholder,
	keyPrefix,
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
	}, [value, providerLabel]);

	const handleSave = async () => {
		const normalized = apiKey.trim();

		if (normalized.length < 10) {
			setIsError(true);
			setFeedback(`Enter a valid ${providerLabel} API key.`);
			return;
		}

		if (keyPrefix && !normalized.startsWith(keyPrefix)) {
			setIsError(true);
			setFeedback(`${providerLabel} keys typically start with "${keyPrefix}". Double-check the key.`);
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
					className="text-sm font-semibold text-foreground"
					htmlFor="api-key">
					{providerLabel} API key
				</label>
				<span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">
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
						placeholder={placeholder}
						autoComplete="off"
						spellCheck={false}
						maxLength={256}
						className="h-9 w-full rounded-md border border-input bg-background px-3 pr-14 text-sm text-foreground outline-none transition-[border,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
					/>
					<button
						type="button"
						onClick={() => setVisible((current) => !current)}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-[background-color,color]">
						{visible ? 'Hide' : 'Show'}
					</button>
				</div>
				<Button
					type="button"
					onClick={handleSave}
					disabled={saving}
					variant="default"
					className="h-9 px-4 text-sm font-semibold transition-transform active:scale-[0.96] disabled:cursor-wait">
					{saving ? 'Saving…' : 'Save'}
				</Button>
			</div>
			<p
				className={`min-h-4 text-xs ${isError ? 'text-destructive' : 'text-muted-foreground'}`}
				role={isError ? 'alert' : 'status'}>
				{feedback}
			</p>
		</section>
	);
}
