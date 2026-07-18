import { useState } from 'react';
import { MAX_STYLE_EXAMPLES } from '../../lib/storage';
import { Button } from '@/components/ui/button';
import { FileText, Pencil, X } from 'lucide-react';

interface StyleExamplesProps {
	styleExamples: string[];
	onChange: (examples: string[]) => void;
}

export default function StyleExamples({ styleExamples, onChange }: StyleExamplesProps) {
	const [example, setExample] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [error, setError] = useState('');

	const isEditing = editingIndex !== null;
	const canAdd = styleExamples.length < MAX_STYLE_EXAMPLES;

	const openAdd = () => {
		setEditingIndex(null);
		setExample('');
		setIsAdding(true);
		setError('');
	};

	const openEdit = (index: number) => {
		setEditingIndex(index);
		setExample(styleExamples[index]);
		setIsAdding(true);
		setError('');
	};

	const handleSave = () => {
		const trimmed = example.trim();
		if (!trimmed) {
			setError('Please paste an example comment.');
			return;
		}
		const duplicateIndex = styleExamples.findIndex(
			(ex, i) => ex === trimmed && i !== editingIndex,
		);
		if (duplicateIndex !== -1) {
			setError('This example is already added.');
			return;
		}
		if (!isEditing && !canAdd) {
			setError(`Maximum of ${MAX_STYLE_EXAMPLES} examples reached.`);
			return;
		}

		if (isEditing) {
			onChange(styleExamples.map((ex, i) => (i === editingIndex ? trimmed : ex)));
		} else {
			onChange([...styleExamples, trimmed]);
		}
		setExample('');
		setIsAdding(false);
		setEditingIndex(null);
		setError('');
	};

	const handleCancel = () => {
		setIsAdding(false);
		setEditingIndex(null);
		setExample('');
		setError('');
	};

	const handleDelete = (index: number) => {
		if (editingIndex === index) handleCancel();
		onChange(styleExamples.filter((_, i) => i !== index));
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<div>
					<label className="text-sm font-semibold text-foreground text-balance">
						Voice Mirroring
					</label>
					<span className="block text-[10px] text-muted-foreground">
						Paste past comments to teach AI your writing rhythm
					</span>
				</div>
				{!isAdding && canAdd && (
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={openAdd}
						className="gap-1"
					>
						+ Add
					</Button>
				)}
			</div>

			{/* Progress dots */}
			<div className="flex items-center gap-1.5" aria-label={`${styleExamples.length} of ${MAX_STYLE_EXAMPLES} slots used`}>
				{Array.from({ length: MAX_STYLE_EXAMPLES }, (_, i) => (
					<span
						key={i}
						className={`h-1.5 flex-1 rounded-full transition-colors ${
							i < styleExamples.length ? 'bg-primary' : 'bg-border'
						}`}
					/>
				))}
				<span className="ml-1 text-[10px] font-medium text-muted-foreground tabular-nums">
					{styleExamples.length}/{MAX_STYLE_EXAMPLES}
				</span>
			</div>

			{isAdding && (
				<div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
					<textarea
						placeholder="Paste a real LinkedIn comment you wrote that represents your style..."
						value={example}
						onChange={(e) => { setExample(e.target.value); setError(''); }}
						rows={3}
						maxLength={500}
						autoFocus
						className="w-full resize-none rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring/20"
					/>
					{error && <p className="text-[11px] font-medium text-destructive">{error}</p>}
					<div className="flex justify-end gap-2">
						<Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
							Cancel
						</Button>
						<Button type="button" variant="default" size="sm" onClick={handleSave}>
							{isEditing ? 'Update Example' : 'Save Example'}
						</Button>
					</div>
				</div>
			)}

			{styleExamples.length === 0 && !isAdding ? (
				<div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/50 px-4 py-5 text-center">
					<FileText className="h-5 w-5 text-muted-foreground/40" />
					<p className="text-xs font-medium text-muted-foreground">No style examples yet</p>
					<p className="text-[10px] text-muted-foreground/60">
						Add comments you've written so the AI can match your voice.
					</p>
				</div>
			) : (
				<div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
					{styleExamples.map((ex, index) => (
						<div
							key={index}
							className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md"
						>
							<div className="min-w-0 flex-1">
								<p className="text-xs leading-relaxed text-foreground">
									<span className="text-muted-foreground/40">&ldquo;</span>{ex}<span className="text-muted-foreground/40">&rdquo;</span>
								</p>
							</div>
							<div className="flex items-center gap-0.5 shrink-0">
								<button
									type="button"
									onClick={() => openEdit(index)}
									title="Edit example"
									className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-[opacity,color] hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
								>
									<Pencil className="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									onClick={() => handleDelete(index)}
									title="Delete example"
									className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-[opacity,color] hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}