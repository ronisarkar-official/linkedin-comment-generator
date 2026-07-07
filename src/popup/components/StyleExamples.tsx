import { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface StyleExamplesProps {
	styleExamples: string[];
	onChange: (examples: string[]) => void;
}

export default function StyleExamples({ styleExamples, onChange }: StyleExamplesProps) {
	const [example, setExample] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [error, setError] = useState('');

	const handleAdd = () => {
		if (!example.trim()) {
			setError('Please paste an example comment.');
			return;
		}
		if (styleExamples.includes(example.trim())) {
			setError('This example is already added.');
			return;
		}
		onChange([...styleExamples, example.trim()]);
		setExample('');
		setIsAdding(false);
		setError('');
	};

	const handleDelete = (index: number) => {
		onChange(styleExamples.filter((_, i) => i !== index));
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<div>
					<label className="text-sm font-semibold text-slate-800">
						Voice Mirroring
					</label>
					<span className="block text-[10px] text-slate-500">
						Paste past comments to teach AI your writing rhythm
					</span>
				</div>
				{!isAdding && (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="text-xs font-semibold text-blue-600 hover:text-blue-800">
						+ Add Example
					</button>
				)}
			</div>

			{isAdding && (
				<div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-sm">
					<textarea
						placeholder="Paste a real LinkedIn comment you wrote that represents your style..."
						value={example}
						onChange={(e) => setExample(e.target.value)}
						rows={3}
						className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-blue-600"
					/>
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
							Save Example
						</button>
					</div>
				</div>
			)}

			{styleExamples.length === 0 && !isAdding ? (
				<p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
					No style examples yet. Add examples to make AI sound like you!
				</p>
			) : (
				<div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
					{styleExamples.map((ex, index) => (
						<div
							key={index}
							className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
							<p className="line-clamp-2 italic">"{ex}"</p>
							<button
								type="button"
								onClick={() => handleDelete(index)}
								className="text-slate-400 hover:text-red-600 shrink-0"
								title="Delete example">
								×
							</button>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
