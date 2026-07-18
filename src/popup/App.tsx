import { useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, History, Loader2, Heart, Settings } from 'lucide-react';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../lib/storage';
import type {
	CommentLength,
	CustomTone,
	LlmProvider,
	UserSettings,
} from '../lib/types';
import { PROVIDERS, getProvider, getModelLabel } from '../lib/llm/registry';
import ApiKeyInput from './components/ApiKeyInput';
import CustomTones from './components/CustomTones';
import HistoryTab from './components/HistoryTab';
import Footer from './components/Footer';
import LengthSelector from './components/LengthSelector';
import StyleExamples from './components/StyleExamples';
import ToneSelector from './components/ToneSelector';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const API_KEY_URLS: Record<string, string> = {
	gemini: 'https://aistudio.google.com/apikey',
	openai: 'https://platform.openai.com/api-keys',
	anthropic: 'https://console.anthropic.com/settings/keys',
	openrouter: 'https://openrouter.ai/keys',
	groq: 'https://console.groq.com/keys',
	together: 'https://api.together.ai/settings/api-keys',
	mistral: 'https://console.mistral.ai/api-keys',
	deepseek: 'https://platform.deepseek.com/api_keys',
	cohere: 'https://dashboard.cohere.com/api-keys',
	perplexity: 'https://www.perplexity.ai/settings/api',
	xai: 'https://console.x.ai',
};

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

	return (
		<main className="flex flex-col w-[360px] min-h-[500px] max-h-[600px] bg-background text-foreground">
			<header className="shrink-0 bg-primary px-4 py-3 text-primary-foreground">
				<div className="flex items-start gap-2.5">
					<img
						src="/icons/icon48.png"
						alt=""
						className="mt-0.5 h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1 ring-primary-foreground/20 outline outline-1 -outline-offset-1 outline-black/10"
					/>
					<div className="min-w-0 flex-1">
						<div className="flex items-center justify-between gap-2">
							<h1 className="truncate text-sm font-bold leading-tight text-balance">
								LinkedIn Comment Generator
							</h1>
							<div className="flex items-center gap-1.5">
							<Dialog>
								<DialogTrigger
									render={
										<Button
											size="xs"
											className="shrink-0 gap-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-2.5 text-[10px] font-bold text-white shadow-sm shadow-pink-500/30 hover:from-pink-600 hover:to-rose-600 transition-all active:scale-[0.96] animate-pulse"
										/>
									}
								>
									<Heart className="h-3 w-3 fill-current" />
									Donate
								</DialogTrigger>
								<DialogContent className="max-w-[300px] p-5">
									<DialogHeader>
										<DialogTitle className="text-center text-base font-bold">
											Support via UPI
										</DialogTitle>
									</DialogHeader>
									<div className="flex flex-col items-center gap-3">
										<div className="overflow-hidden rounded-xl border border-border bg-white p-2">
											<img
												src="/icons/Roni-upi-qr-code.png"
												alt="UPI QR Code"
												className="h-48 w-48 object-contain"
											/>
										</div>
										<p className="text-center text-xs text-muted-foreground">
											Scan this QR code with any UPI app to donate
										</p>
									</div>
								</DialogContent>
							</Dialog>
							</div>
						</div>
						<span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-medium text-primary-foreground/75 truncate tabular-nums">
							{currentProvider.label} / {getModelLabel(settings.provider, settings.model)}
						</span>
					</div>
				</div>
			</header>

			<div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading settings…
					</div>
				) : (
					<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'settings' | 'history')}>
						<TabsList className="flex w-full border-b border-border bg-transparent gap-0 p-0 h-auto shrink-0">
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
								<div className="relative">
									<select
										id="provider-select"
										value={settings.provider}
										onChange={(e) => updateProvider(e.target.value as LlmProvider)}
										className="h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-xs font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow] hover:border-foreground/30 focus:border-primary focus:ring-2 focus:ring-ring/20"
									>
										{PROVIDERS.map((p) => (
											<option key={p.id} value={p.id}>
												{p.label}{(p.id === 'gemini' || p.id === 'openrouter') ? ' (Free)' : ''}
											</option>
										))}
									</select>
									<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
								</div>
								<div className="relative">
									<select
										id="model-select"
										value={settings.model}
										onChange={(e) => updateModel(e.target.value)}
										className="h-9 w-full cursor-pointer appearance-none rounded-md border border-input bg-background pl-3 pr-7 text-xs font-medium text-foreground shadow-sm outline-none transition-[border-color,box-shadow] hover:border-foreground/30 focus:border-primary focus:ring-2 focus:ring-ring/20"
									>
										{currentProvider.models.map((m) => (
											<option key={m.id} value={m.id}>
												{m.label}
											</option>
										))}
									</select>
									<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
								</div>
							</div>
							{API_KEY_URLS[settings.provider] && (
								<a
									href={API_KEY_URLS[settings.provider]}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline transition-colors"
								>
									<ExternalLink className="h-3 w-3" />
									Get {currentProvider.label} API key
								</a>
							)}
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

						<p className="min-h-4 text-center text-xs text-muted-foreground" role="status">
							{status}
						</p>
					</TabsContent>

					<TabsContent value="history" className="m-0 p-4">
						<HistoryTab />
					</TabsContent>
				</Tabs>
			)}
			</div>
			<Footer />
		</main>
	);
}