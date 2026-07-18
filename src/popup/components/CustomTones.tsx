import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { CustomTone } from '../../lib/types';
import { BUILTIN_TONES } from '../../lib/types';
import { Button } from '@/components/ui/button';

interface CustomTonesProps {
	customTones: CustomTone[];
	onChange: (tones: CustomTone[]) => void;
}

export default function CustomTones({ customTones, onChange }: CustomTonesProps) {
	const [label, setLabel] = useState('');
	const [prompt, setPrompt] = useState('');
	const [isAdding, setIsAdding] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [error, setError] = useState('');

	const isEditing = editingId !== null;
	const editingTone = isEditing ? customTones.find((t) => t.id === editingId) : null;

	const openAdd = () => {
		setEditingId(null);
		setLabel('');
		setPrompt('');
		setIsAdding(true);
		setError('');
	};

	const openEdit = (tone: CustomTone) => {
		setEditingId(tone.id);
		setLabel(tone.label);
		setPrompt(tone.prompt);
		setIsAdding(true);
		setError('');
	};

	const handleSave = () => {
		if (!label.trim() || !prompt.trim()) {
			setError('Enter both a name and instructions.');
			return;
		}
		if ((BUILTIN_TONES as readonly string[]).includes(label.trim().toLowerCase())) {
			setError(`"${label.trim()}" is a built-in tone. Choose a different name.`);
			return;
		}
		const duplicate = customTones.some(
			(t) => t.label.toLowerCase() === label.trim().toLowerCase() && t.id !== editingId,
		);
		if (duplicate) {
			setError('A tone with this name already exists.');
			return;
		}

		if (isEditing && editingTone) {
			onChange(
				customTones.map((t) =>
					t.id === editingId ? { ...t, label: label.trim(), prompt: prompt.trim() } : t,
				),
			);
		} else {
			const newTone: CustomTone = {
				id: 'ct_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
				label: label.trim(),
				prompt: prompt.trim(),
			};
			onChange([...customTones, newTone]);
		}
		setLabel('');
		setPrompt('');
		setIsAdding(false);
		setEditingId(null);
		setError('');
	};

	const handleDelete = (id: string) => {
		if (editingId === id) {
			setEditingId(null);
			setIsAdding(false);
			setLabel('');
			setPrompt('');
		}
		onChange(customTones.filter((t) => t.id !== id));
	};

	const handleCancel = () => {
		setIsAdding(false);
		setEditingId(null);
		setLabel('');
		setPrompt('');
		setError('');
	};

	return (
		<section className="space-y-2">
			<div className="flex items-center justify-between">
				<label className="text-sm font-semibold text-foreground">
					Custom Tones
				</label>
				{!isAdding && (
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={openAdd}
						className="gap-1"
					>
						<Plus className="h-3 w-3" />
						Add
					</Button>
				)}
			</div>

			{isAdding && (
				<div className="space-y-2.5 rounded-xl border border-border bg-card p-3 shadow-sm">
					<div className="space-y-1.5">
						<label className="text-[11px] font-medium text-muted-foreground">Tone name</label>
						<input
							type="text"
							placeholder="e.g. Socratic, Bold, Storyteller"
							value={label}
							onChange={(e) => { setLabel(e.target.value); setError(''); }}
							autoFocus
							className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring/20"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-[11px] font-medium text-muted-foreground">Instructions</label>
						<textarea
							placeholder="e.g. Ask thought-provoking questions that challenge assumptions"
							value={prompt}
							onChange={(e) => { setPrompt(e.target.value); setError(''); }}
							rows={2}
							className="w-full resize-none rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring/20"
						/>
					</div>
					{error && (
						<p className="text-[11px] font-medium text-destructive">{error}</p>
					)}
					<div className="flex justify-end gap-2 pt-0.5">
						<Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
							Cancel
						</Button>
						<Button type="button" variant="default" size="sm" onClick={handleSave}>
							{isEditing ? 'Update Tone' : 'Save Tone'}
						</Button>
					</div>
				</div>
			)}

			{customTones.length === 0 && !isAdding ? (
				<div className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/50 px-4 py-5 text-center">
					<Plus className="h-5 w-5 text-muted-foreground/40" />
					<p className="text-xs font-medium text-muted-foreground">No custom tones yet</p>
					<p className="text-[10px] text-muted-foreground/60">
						Create your own tone to match your unique voice.
					</p>
				</div>
			) : (
				<div className="space-y-1.5">
					{customTones.map((tone) => (
						<div
							key={tone.id}
							className="group flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md"
						>
							<div className="min-w-0 flex-1">
								<p className="text-xs font-semibold text-foreground">{tone.label}</p>
								<p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
									{tone.prompt}
								</p>
							</div>
							<div className="flex items-center gap-0.5">
								<button
									type="button"
									onClick={() => openEdit(tone)}
									title="Edit custom tone"
									className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-[opacity,color] hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
								>
									<Pencil className="h-3.5 w-3.5" />
								</button>
								<button
									type="button"
									onClick={() => handleDelete(tone.id)}
									title="Delete custom tone"
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
