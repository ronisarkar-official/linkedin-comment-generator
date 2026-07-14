import { useState } from 'react';
import type { CustomTone, Tone } from '../../lib/types';
import { BUILTIN_TONES } from '../../lib/types';
import { MAX_CUSTOM_TONES } from '../../lib/storage';
import { Button } from '@/components/ui/button';

interface CustomTonesProps {
	customTones: CustomTone[];
	onChange: (tones: CustomTone[]) => void;
}

export default function CustomTones({ customTones, onChange }: CustomTonesProps) {
	const [label, setLabel] = useState('');
	const [prompt, setPrompt] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [error, setError] = useState('');

	const canAdd = customTones.length < MAX_CUSTOM_TONES;

	const handleAdd = () => {
		if (!label.trim() || !prompt.trim()) {
			setError('Please enter both a name and instructions.');
			return;
		}
		if ((BUILTIN_TONES as readonly string[]).includes(label.trim().toLowerCase())) {
			setError(`"${label.trim()}" is a built-in tone. Choose a different name.`);
			return;
		}
		if (customTones.some((t) => t.label.toLowerCase() === label.trim().toLowerCase())) {
			setError('A tone with this name already exists.');
			return;
		}
		if (!canAdd) {
			setError(`Maximum of ${MAX_CUSTOM_TONES} custom tones reached.`);
			return;
		}
		const newTone: CustomTone = {
			id: 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
			label: label.trim(),
			prompt: prompt.trim(),
		};
		onChange([...customTones, newTone]);
		setLabel('');
		setPrompt('');
		setIsAdding(false);
		setError('');
	};

	const handleDelete = (id: string) => {
		onChange(customTones.filter((t) => t.id !== id));
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<label className="text-sm font-semibold text-foreground">
					Custom Tones
					<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
						({customTones.length}/{MAX_CUSTOM_TONES})
					</span>
				</label>
				{!isAdding && canAdd && (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="text-xs font-semibold text-primary hover:text-primary/80 transition-[color]">
						+ Add Tone
					</button>
				)}
			</div>

			{isAdding && (
				<div className="space-y-2 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
					<div>
						<input
							type="text"
							placeholder="Tone name (e.g. Socratic, Bold)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							maxLength={30}
							className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
						/>
					</div>
					<div>
						<input
							type="text"
							placeholder="Instructions (e.g. Ask thought-provoking questions)"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							maxLength={300}
							className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary"
						/>
					</div>
					{error && <p className="text-[11px] text-destructive">{error}</p>}
					<div className="flex justify-end gap-2 pt-1">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setIsAdding(false);
								setError('');
							}}>
							Cancel
						</Button>
						<Button
							type="button"
							variant="default"
							size="sm"
							onClick={handleAdd}
							className="transition-transform active:scale-[0.96]">
							Save Tone
						</Button>
					</div>
				</div>
			)}

			{customTones.length === 0 && !isAdding ? (
				<p className="rounded-xl border border-dashed border-border bg-muted p-3 text-center text-xs text-muted-foreground">
					No custom tones yet. Click "+ Add Tone" to create your own!
				</p>
			) : (
				<div className="space-y-1.5">
					{customTones.map((tone) => (
						<div
							key={tone.id}
							className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
							<div>
								<span className="font-semibold text-foreground">{tone.label}</span>
								<span className="ml-1.5 text-muted-foreground">({tone.prompt})</span>
							</div>
							<button
								type="button"
								onClick={() => handleDelete(tone.id)}
								className="text-muted-foreground hover:text-destructive"
								title="Delete custom tone">
								×
							</button>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
