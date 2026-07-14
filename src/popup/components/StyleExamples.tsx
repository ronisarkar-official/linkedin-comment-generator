import { useState } from 'react';
import { MAX_STYLE_EXAMPLES } from '../../lib/storage';
import { Button } from '@/components/ui/button';

interface StyleExamplesProps {
	styleExamples: string[];
	onChange: (examples: string[]) => void;
}

export default function StyleExamples({ styleExamples, onChange }: StyleExamplesProps) {
	const [example, setExample] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [error, setError] = useState('');

	const canAdd = styleExamples.length < MAX_STYLE_EXAMPLES;

	const handleAdd = () => {
		if (!example.trim()) {
			setError('Please paste an example comment.');
			return;
		}
		if (styleExamples.includes(example.trim())) {
			setError('This example is already added.');
			return;
		}
		if (!canAdd) {
			setError(`Maximum of ${MAX_STYLE_EXAMPLES} examples reached.`);
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
					<label className="text-sm font-semibold text-foreground">
						Voice Mirroring
						<span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
							({styleExamples.length}/{MAX_STYLE_EXAMPLES})
						</span>
					</label>
					<span className="block text-[10px] text-muted-foreground">
						Paste past comments to teach AI your writing rhythm
					</span>
				</div>
				{!isAdding && canAdd && (
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="text-xs font-semibold text-primary hover:text-primary/80">
						+ Add Example
					</button>
				)}
			</div>

			{isAdding && (
				<div className="space-y-2 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
					<textarea
						placeholder="Paste a real LinkedIn comment you wrote that represents your style..."
						value={example}
						onChange={(e) => setExample(e.target.value)}
						rows={3}
						maxLength={500}
						className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-[border] focus:border-primary"
					/>
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
							Save Example
						</Button>
					</div>
				</div>
			)}

			{styleExamples.length === 0 && !isAdding ? (
				<p className="rounded-xl border border-dashed border-border bg-muted p-3 text-center text-xs text-muted-foreground">
					No style examples yet. Add examples to make AI sound like you!
				</p>
			) : (
				<div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
					{styleExamples.map((ex, index) => (
						<div
							key={index}
							className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground">
							<p className="line-clamp-2 italic">"{ex}"</p>
							<button
								type="button"
								onClick={() => handleDelete(index)}
								className="text-muted-foreground hover:text-destructive shrink-0"
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
