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
			<legend className="text-sm font-semibold text-slate-800">
				Preferred tone
			</legend>
			<div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
				{options.map((option) => (
					<label
						key={option.value}
						className={`cursor-pointer rounded-lg px-2 py-2 text-center text-xs font-semibold transition truncate ${
							value === option.value ?
								'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
							:	'text-slate-600 hover:text-slate-900'
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
