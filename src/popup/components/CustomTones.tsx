import { useState } from 'react';
import type { CustomTone } from '../../lib/types';

interface CustomTonesProps {
	customTones: CustomTone[];
	onChange: (tones: CustomTone[]) => void;
}

export default function CustomTones({ customTones, onChange }: CustomTonesProps) {
	const [label, setLabel] = useState('');
	const [prompt, setPrompt] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [error, setError] = useState('');

	const handleAdd = () => {
		if (!label.trim() || !prompt.trim()) {
			setError('Please enter both a name and instructions.');
			return;
		}
		if (customTones.some((t) => t.label.toLowerCase() === label.trim().toLowerCase())) {
			setError('A tone with this name already exists.');
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
				<label className="text-sm font-semibold text-slate-800">
					Custom Tones
				</label>
				{!isAdding && (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="text-xs font-semibold text-blue-600 hover:text-blue-800">
						+ Add Tone
					</button>
				)}
			</div>

			{isAdding && (
				<div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-sm">
					<div>
						<input
							type="text"
							placeholder="Tone name (e.g. Socratic, Bold)"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
						/>
					</div>
					<div>
						<input
							type="text"
							placeholder="Instructions (e.g. Ask thought-provoking questions)"
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
						/>
					</div>
					{error && <p className="text-[11px] text-red-600">{error}</p>}
					<div className="flex justify-end gap-2 pt-1">
						<button
							type="button"
							onClick={() => {
								setIsAdding(false);
								setError('');
							}}
							className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900">
							Cancel
						</button>
						<button
							type="button"
							onClick={handleAdd}
							className="rounded bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">
							Save Tone
						</button>
					</div>
				</div>
			)}

			{customTones.length === 0 && !isAdding ? (
				<p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
					No custom tones yet. Click "+ Add Tone" to create your own!
				</p>
			) : (
				<div className="space-y-1.5">
					{customTones.map((tone) => (
						<div
							key={tone.id}
							className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
							<div>
								<span className="font-semibold text-slate-800">{tone.label}</span>
								<span className="ml-1.5 text-slate-500">({tone.prompt})</span>
							</div>
							<button
								type="button"
								onClick={() => handleDelete(tone.id)}
								className="text-slate-400 hover:text-red-600"
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
