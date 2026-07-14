import { useEffect, useState } from 'react';
import { History, Loader2, Heart, Settings } from 'lucide-react';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/storage';
import type {
	CommentLength,
	CustomTone,
	LlmProvider,
	PromptPreferences,
	UserSettings,
} from '../lib/types';
import { PROVIDERS, getProvider, getModelLabel } from '../lib/llm/registry';
import ApiKeyInput from './components/ApiKeyInput';
import CustomTones from './components/CustomTones';
import HistoryTab from './components/HistoryTab';
import LengthSelector from './components/LengthSelector';
import StyleExamples from './components/StyleExamples';
import ToneSelector from './components/ToneSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const QUALITY_CONTROLS = [
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
];

export default function App() {
	const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [status, setStatus] = useState('');
	const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');

	useEffect(() => {
		void getSettings()
			.then(setSettings)
			.catch(() => setStatus('Could not load saved settings.'))
			.finally(() => setLoading(false));
	}, []);

	const currentProvider = getProvider(settings.provider);

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

	const persist = (patch: Partial<UserSettings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch };
			saveSettings(next).catch(() => setStatus('Could not save settings.'));
			return next;
		});
	};

	const updateTone = (defaultTone: string) => {
		setStatus('');
		persist({ defaultTone });
	};

	const updateCustomTones = (customTones: CustomTone[]) => {
		setStatus('');
		persist({ customTones });
	};

	const updateStyleExamples = (styleExamples: string[]) => {
		setStatus('');
		persist({ styleExamples });
	};

	const updateProvider = (provider: LlmProvider) => {
		setStatus('');
		const providerConfig = getProvider(provider);
		persist({ provider, model: providerConfig.models[0].id });
	};

	const updateModel = (model: string) => {
		setStatus('');
		persist({ model });
	};

	const updateLength = (commentLength: CommentLength) => {
		setStatus('');
		persist({ commentLength });
	};

	const updateProfileSummary = (profileSummary: string) => {
		setStatus('');
		persist({ profileSummary });
	};

	const updatePromptPreference = (key: keyof PromptPreferences, value: boolean) => {
		setStatus('');
		setSettings((current) => {
			const next = {
				...current,
				promptPreferences: { ...current.promptPreferences, [key]: value },
			};
			saveSettings(next).catch(() => setStatus('Could not save settings.'));
			return next;
		});
	};

	return (
		<main className="w-[360px] min-h-[500px] bg-background text-foreground">
			<header className="bg-primary px-4 py-3 text-primary-foreground">
				<div className="flex items-start gap-2.5">
					<img
						src="/icons/icon48.png"
						alt=""
						className="mt-0.5 h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1 ring-primary-foreground/20 outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<h1 className="truncate text-sm font-bold leading-tight text-balance">
								LinkedIn Comment Generator
							</h1>
							<Button
								render={(props) => (
									<a
										{...props}
										href="https://github.com/sponsors/ronisarkar-official"
										target="_blank"
										rel="noopener noreferrer"
									/>
								)}
								size="xs"
								className="shrink-0 gap-1 rounded-full bg-primary-foreground/15 px-2 text-[10px] font-bold text-primary-foreground hover:bg-primary-foreground/25 transition-transform active:scale-[0.96]"
							>
								<Heart className="h-3 w-3 fill-current" />
								Sponsor
							</Button>
						</div>
						<span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-medium text-primary-foreground/75 truncate tabular-nums">
							{currentProvider.label} / {getModelLabel(settings.provider, settings.model)}
						</span>
					</div>
				</div>
			</header>

			{loading ? (
				<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading settings…
				</div>
			) : (
				<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'settings' | 'history')}>
					<TabsList className="flex w-full border-b border-border bg-transparent gap-0 p-0 h-auto">
						<TabsTrigger
							value="settings"
							className="relative flex-1 flex items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-foreground data-active:text-foreground data-active:border-foreground data-active:bg-transparent rounded-none shadow-none transition-[color,border-color] hover:text-foreground"
						>
							<Settings className="h-3.5 w-3.5" />
							Settings
						</TabsTrigger>
						<TabsTrigger
							value="history"
							className="relative flex-1 flex items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-foreground data-active:text-foreground data-active:border-foreground data-active:bg-transparent rounded-none shadow-none transition-[color,border-color] hover:text-foreground"
						>
							<History className="h-3.5 w-3.5" />
							History
						</TabsTrigger>
					</TabsList>

					<TabsContent value="settings" className="m-0 space-y-4 p-4">
						{/* Provider & Model selectors */}
						<div className="space-y-2">
							<Label className="text-sm font-semibold text-foreground">AI provider &amp; model</Label>
							<div className="grid grid-cols-2 gap-2">
								<select
									id="provider-select"
									value={settings.provider}
									onChange={(e) => updateProvider(e.target.value as LlmProvider)}
									className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
								>
									{PROVIDERS.map((p) => (
										<option key={p.id} value={p.id}>
											{p.label}
										</option>
									))}
								</select>
								<select
									id="model-select"
									value={settings.model}
									onChange={(e) => updateModel(e.target.value)}
									className="h-9 w-full appearance-none rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
								>
									{currentProvider.models.map((m) => (
										<option key={m.id} value={m.id}>
											{m.label}
										</option>
									))}
								</select>
							</div>
						</div>

						<ApiKeyInput
							value={settings.apiKeys[settings.provider] ?? ''}
							providerLabel={currentProvider.label}
							placeholder={currentProvider.keyPlaceholder}
							keyPrefix={currentProvider.keyPrefix}
							onSave={saveApiKey}
						/>

						<Separator />

						<ToneSelector value={settings.defaultTone} customTones={settings.customTones} onChange={updateTone} />
						<CustomTones customTones={settings.customTones || []} onChange={updateCustomTones} />
						<LengthSelector value={settings.commentLength} onChange={updateLength} />

						<div className="space-y-2">
							<div className="flex items-end justify-between gap-3">
								<Label htmlFor="profile-summary" className="text-sm font-semibold text-foreground">
									Your profile / interests
								</Label>
								<span className="text-[10px] font-medium text-muted-foreground text-pretty">
									Helps the comment sound more like you
								</span>
							</div>
							<Textarea
								id="profile-summary"
								value={settings.profileSummary}
								onChange={(event) => updateProfileSummary(event.target.value)}
								placeholder="Example: product designer, cares about accessibility, likes direct and warm writing"
								rows={2}
								maxLength={600}
								className="text-xs"
							/>
						</div>

						<StyleExamples styleExamples={settings.styleExamples || []} onChange={updateStyleExamples} />

						<div className="space-y-2">
							<Label className="text-sm font-semibold text-foreground">Prompt quality controls</Label>
							<Card className="border-border">
								<CardContent className="space-y-1 p-3">
									{QUALITY_CONTROLS.map((option) => (
										<div
											key={option.key}
											className="flex items-start justify-between gap-3 rounded-lg px-1 py-1.5 hover:bg-accent"
										>
											<div>
												<p className="text-xs font-medium text-foreground">{option.label}</p>
												<p className="text-[11px] text-muted-foreground">{option.detail}</p>
											</div>
											<Switch
												checked={settings.promptPreferences[option.key]}
												onCheckedChange={(checked) => updatePromptPreference(option.key, checked)}
											/>
										</div>
									))}
								</CardContent>
							</Card>
						</div>

						<p className="min-h-4 text-center text-xs text-muted-foreground" role="status">
							{status}
						</p>
					</TabsContent>

					<TabsContent value="history" className="m-0 p-4">
						<HistoryTab />
					</TabsContent>
				</Tabs>
			)}
		</main>
	);
}