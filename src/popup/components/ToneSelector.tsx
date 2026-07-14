import type { CustomTone } from '../../lib/types';

interface ToneSelectorProps {
	value: string;
	customTones?: CustomTone[];
	onChange: (tone: string) => void;
}

export default function ToneSelector({
	value,
	customTones = [],
	onChange,
}: ToneSelectorProps) {
	const options = [
		{ value: 'professional', label: 'Professional' },
		{ value: 'witty', label: 'Witty' },
		{ value: 'supportive', label: 'Supportive' },
		...customTones.map((ct) => ({ value: ct.id, label: ct.label })),
	];

	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-semibold text-foreground">
				Preferred tone
			</legend>
			<div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
				{options.map((option) => (
					<label
						key={option.value}
						className={`cursor-pointer rounded-lg px-2 py-2 text-center text-xs font-semibold transition-[background-color,box-shadow,color] truncate active:scale-[0.96] ${
							value === option.value ?
								'bg-background text-primary shadow-sm ring-1 ring-border'
							:	'text-muted-foreground hover:text-foreground'
						}`}
						title={option.label}>
						<input
							type="radio"
							name="tone"
							value={option.value}
							checked={value === option.value}
							onChange={() => onChange(option.value)}
							className="sr-only"
						/>
						{option.label}
					</label>
				))}
			</div>
		</fieldset>
	);
}
