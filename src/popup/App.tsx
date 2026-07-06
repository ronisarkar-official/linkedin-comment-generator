import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/storage';
import type {
	CommentLength,
	LlmProvider,
	PromptPreferences,
	Tone,
	UserSettings,
} from '../lib/types';
import ApiKeyInput from './components/ApiKeyInput';
import LengthSelector from './components/LengthSelector';
import ToneSelector from './components/ToneSelector';

export default function App() {
	const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [status, setStatus] = useState('');

	useEffect(() => {
		void getSettings()
			.then(setSettings)
			.catch(() => setStatus('Could not load saved settings.'))
			.finally(() => setLoading(false));
	}, []);

	const saveApiKey = async (apiKey: string) => {
		const next = {
			...settings,
			apiKeys: {
				...settings.apiKeys,
				[settings.provider]: apiKey,
			},
		};
		await saveSettings(next);
		setSettings(next);
	};

	const updateTone = (defaultTone: Tone) => {
		setSettings((current) => ({ ...current, defaultTone }));
		setStatus('');
	};

	const updateProvider = (provider: LlmProvider) => {
		setSettings((current) => ({ ...current, provider }));
		setStatus('');
	};

	const updateLength = (commentLength: CommentLength) => {
		setSettings((current) => ({ ...current, commentLength }));
		setStatus('');
	};

	const updateProfileSummary = (profileSummary: string) => {
		setSettings((current) => ({ ...current, profileSummary }));
		setStatus('');
	};

	const updatePromptPreference = (
		key: keyof PromptPreferences,
		value: boolean,
	) => {
		setSettings((current) => ({
			...current,
			promptPreferences: {
				...current.promptPreferences,
				[key]: value,
			},
		}));
		setStatus('');
	};

	const savePreferences = async () => {
		setSaving(true);
		setStatus('');
		try {
			await saveSettings(settings);
			setStatus('Preferences saved.');
		} catch {
			setStatus('Could not save preferences.');
		} finally {
			setSaving(false);
		}
	};

	return (
		<main className="w-[360px] bg-slate-50 text-slate-900">
			<header className="bg-gradient-to-br from-blue-700 to-blue-500 px-5 py-5 text-white">
				<div className="flex items-center gap-3">
					<img
						src="/icons/icon48.png"
						alt=""
						className="h-10 w-10 rounded-xl shadow-sm"
					/>
					<div>
						<h1 className="text-lg font-bold leading-tight">
							LinkedIn Comment Generator
						</h1>
						<p className="mt-0.5 text-xs text-blue-100">
							{settings.provider === 'openrouter' ?
								'OpenRouter Free Router'
							:	'Gemini 2.5 Flash'}
						</p>
					</div>
				</div>
			</header>

			<div className="space-y-5 p-5">
				{loading ?
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
						Loading settings…
					</div>
				:	<>
						<fieldset className="space-y-2">
							<legend className="text-sm font-semibold text-slate-800">
								AI provider
							</legend>
							<div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
								{(['gemini', 'openrouter'] as LlmProvider[]).map((provider) => (
									<label
										key={provider}
										className={`cursor-pointer rounded-lg px-3 py-2 text-center text-xs font-semibold transition ${
											settings.provider === provider ?
												'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
											:	'text-slate-600 hover:text-slate-900'
										}`}>
										<input
											type="radio"
											name="provider"
											value={provider}
											checked={settings.provider === provider}
											onChange={() => updateProvider(provider)}
											className="sr-only"
										/>
										{provider === 'gemini' ? 'Gemini' : 'OpenRouter'}
									</label>
								))}
							</div>
						</fieldset>
						<ApiKeyInput
							value={settings.apiKeys[settings.provider]}
							provider={settings.provider}
							onSave={saveApiKey}
						/>
						<div className="h-px bg-slate-200" />
						<ToneSelector
							value={settings.defaultTone}
							onChange={updateTone}
						/>
						<LengthSelector
							value={settings.commentLength}
							onChange={updateLength}
						/>
						<section className="space-y-2">
							<div className="flex items-end justify-between gap-3">
								<label
									className="text-sm font-semibold text-slate-800"
									htmlFor="profile-summary">
									Your profile / interests
								</label>
								<span className="text-[10px] font-medium text-slate-500">
									Helps the comment sound more like you
								</span>
							</div>
							<textarea
								id="profile-summary"
								value={settings.profileSummary}
								onChange={(event) => updateProfileSummary(event.target.value)}
								placeholder="Example: product designer, cares about accessibility, likes direct and warm writing"
								rows={3}
								className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
							/>
						</section>
						<section className="space-y-2">
							<legend className="text-sm font-semibold text-slate-800">
								Prompt quality controls
							</legend>
							<div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
								{[
									{
										key: 'avoidBuzzwords' as const,
										label: 'Avoid buzzwords',
										detail: 'Skips corporate filler and vague hype words.',
									},
									{
										key: 'avoidCliches' as const,
										label: 'Avoid clichés',
										detail: 'Avoids overused openers and generic praise.',
									},
									{
										key: 'avoidAIGenerated' as const,
										label: 'Avoid sounding AI-generated',
										detail: 'Pushes the reply toward a more natural rhythm.',
									},
									{
										key: 'preferFreshAngles' as const,
										label: 'Prefer fresh angles',
										detail: 'Helps repeated posts get different comment ideas.',
									},
								].map((option) => (
									<label
										key={option.key}
										className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-1 hover:bg-slate-50">
										<input
											type="checkbox"
											checked={settings.promptPreferences[option.key]}
											onChange={(event) =>
												updatePromptPreference(option.key, event.target.checked)
											}
											className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
										/>
										<span>
											<span className="block font-medium text-slate-800">
												{option.label}
											</span>
											<span className="block text-xs text-slate-500">
												{option.detail}
											</span>
										</span>
									</label>
								))}
							</div>
						</section>
						<button
							type="button"
							onClick={savePreferences}
							disabled={saving}
							className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60">
							{saving ? 'Saving…' : 'Save preferences'}
						</button>
						<p
							className="min-h-4 text-center text-xs text-emerald-700"
							role="status">
							{status}
						</p>
					</>
				}
			</div>
		</main>
	);
}
