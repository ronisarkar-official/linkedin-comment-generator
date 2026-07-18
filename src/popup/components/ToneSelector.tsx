import { BUILTIN_TONES, type CustomTone } from '../../lib/types';

interface ToneSelectorProps {
	value: string;
	customTones?: CustomTone[];
	onChange: (tone: string) => void;
}

const BUILTIN_OPTIONS = BUILTIN_TONES.map((value) => ({
	value,
	label: value.charAt(0).toUpperCase() + value.slice(1),
}));

export default function ToneSelector({
	value,
	customTones = [],
	onChange,
}: ToneSelectorProps) {
	const options = [
		...BUILTIN_OPTIONS,
		...customTones.map((ct) => ({ value: ct.id, label: ct.label })),
	];

	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-semibold text-foreground">Preferred tone</legend>
			<div className="grid grid-cols-3 gap-2">
				{options.map((option) => (
					<label
						key={option.value}
						className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-[border-color,background-color,color] active:scale-[0.96] ${
							value === option.value
								? 'border-primary bg-primary/10 text-primary'
								: 'border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground'
						}`}
						title={option.label}
					>
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
