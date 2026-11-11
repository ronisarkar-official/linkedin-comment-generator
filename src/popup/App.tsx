import { useEffect, useMemo, useState } from 'react';
import {
	ExternalLink,
	History,
	Loader2,
	Heart,
	RotateCw,
	Settings,
} from 'lucide-react';
import {
	DEFAULT_SETTINGS,
	MAX_PROMOTIONAL_MESSAGE_LENGTH,
	getSettings,
	saveSettings,
} from '../lib/storage';
import type {
	CommentLength,
	CustomTone,
	FetchModelsMessage,
	FetchModelsResponse,
	LlmProvider,
	ModelConfig,
	UserSettings,
} from '../lib/types';
import {
	PROVIDERS,
	getDefaultModels,
	getModelLabel,
	getProvider,
} from '../lib/llm/registry';
import ApiKeyInput from './components/ApiKeyInput';
import CustomTones from './components/CustomTones';
import HistoryTab from './components/HistoryTab';
import Footer from './components/Footer';
import LengthSelector from './components/LengthSelector';
import LocalAiStatus from './components/LocalAiStatus';
import StyleExamples from './components/StyleExamples';
import ToneSelector from './components/ToneSelector';
import type { LocalProbeResult } from '../lib/llm/local-probe';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const API_KEY_URLS: Record<string, string> = {
	gemini: 'https://aistudio.google.com/apikey',
	openai: 'https://platform.openai.com/api-keys',
	anthropic: 'https://console.anthropic.com/settings/keys',
	openrouter: 'https://openrouter.ai/keys',
	deepseek: 'https://platform.deepseek.com/api_keys',
	perplexity: 'https://www.perplexity.ai/settings/api',
	xai: 'https://console.x.ai',
};

export default function App() {
	const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
	const [loading, setLoading] = useState(true);
	const [status, setStatus] = useState('');
	const [activeTab, setActiveTab] = useState<'settings' | 'history'>(
		'settings',
	);
	const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
	const [loadingModels, setLoadingModels] = useState(false);
	const [modelsNotice, setModelsNotice] = useState('');
	const [manualModelInput, setManualModelInput] = useState(false);

	const loadModels = async (
		provider: LlmProvider,
		apiKey?: string,
		customApiBase?: string,
		forceRefresh = false,
	) => {
		setLoadingModels(true);
		setModelsNotice('');

		try {
			const response = (await chrome.runtime.sendMessage({
				action: 'FETCH_MODELS',
				payload: {
					provider,
					apiKey,
					customApiBase,
					forceRefresh,
				},
			} satisfies FetchModelsMessage)) as FetchModelsResponse;

			if (response?.models && response.models.length > 0) {
				setAvailableModels(response.models);
				setSettings((current) => {
					if (current.provider !== provider) return current;
					const hasCurrentModel = response.models.some(
						(m) => m.id === current.model,
					);
					if (!hasCurrentModel && response.models[0]) {
						const nextModel = response.models[0].id;
						saveSettings({ ...current, model: nextModel }).catch(() => {});
						return { ...current, model: nextModel };
					}
					return current;
				});
			}

			if (response && !response.ok && response.error) {
				if (response.error.code === 'MISSING_API_KEY') {
					setModelsNotice('Add an API key to fetch live models.');
				} else {
					setModelsNotice(
						response.error.message ||
							'Could not fetch live models; using defaults.',
					);
				}
			}
		} catch {
			const fallback = getDefaultModels(provider);
			setAvailableModels(fallback);
		} finally {
			setLoadingModels(false);
		}
	};

	useEffect(() => {
		void getSettings()
			.then((loaded) => {
				setSettings(loaded);
				void loadModels(
					loaded.provider,
					loaded.apiKeys[loaded.provider],
					loaded.customApiBase,
				);
			})
			.catch(() => setStatus('Could not load saved settings.'))
			.finally(() => setLoading(false));
	}, []);

	const currentProvider = getProvider(settings.provider);
	const displayModels =
		availableModels.length > 0 ? availableModels : currentProvider.models;

	const providerItems = useMemo(
		() =>
			PROVIDERS.map((p) => ({
				value: p.id,
				label: `${p.label}${
					p.id === 'gemini' || p.id === 'openrouter' || p.id === 'ollama' ?
						' (Free)'
					:	''
				}`,
			})),
		[],
	);

	const modelItems = useMemo(() => {
		const items: { value: string; label: string }[] = displayModels.map(
			(m) => ({
				value: m.id,
				label: m.label,
			}),
		);
		if (
			settings.model &&
			!items.some((i) => i.value === settings.model) &&
			settings.model !== '__manual__'
		) {
			items.unshift({
				value: settings.model,
				label: getModelLabel(settings.provider, settings.model),
			});
		}
		items.push({
			value: '__manual__',
			label: '✏️ Type model name...',
		});
		return items;
	}, [displayModels, settings.model, settings.provider]);

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
		void loadModels(settings.provider, apiKey, settings.customApiBase, true);
	};

	const persist = (patch: Partial<UserSettings>) => {
		setSettings((current) => {
			const next = { ...current, ...patch };
			saveSettings(next).catch(() => setStatus('Could not save settings.'));
			return next;
		});
	};

	const updateCustomApiBase = (customApiBase: string) => {
		setStatus('');
		persist({ customApiBase });
	};

	const applyCustomPreset = (presetUrl: string) => {
		setStatus('');
		persist({ customApiBase: presetUrl });
		void loadModels(
			settings.provider,
			settings.apiKeys[settings.provider],
			presetUrl,
			true,
		);
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
		const fallbackModels = getDefaultModels(provider);
		const defaultModel = fallbackModels[0]?.id ?? '';
		setAvailableModels(fallbackModels);
		setManualModelInput(false);

		let nextApiBase = settings.customApiBase;
		if (
			provider === 'ollama' &&
			(!nextApiBase || nextApiBase.includes('4096'))
		) {
			nextApiBase = 'http://localhost:11434/v1';
		} else if (
			provider === 'custom' &&
			(!nextApiBase || nextApiBase.includes('11434'))
		) {
			nextApiBase = 'http://localhost:4096/v1';
		}

		persist({ provider, model: defaultModel, customApiBase: nextApiBase });
		void loadModels(provider, settings.apiKeys[provider], nextApiBase);
	};

	const updateModel = (model: string) => {
		setStatus('');
		persist({ model });
	};

	const handleSelectModelFromLocal = (modelId: string) => {
		setAvailableModels((prev) => {
			if (!prev.some((m) => m.id === modelId)) {
				return [{ id: modelId, label: modelId }, ...prev];
			}
			return prev;
		});
		updateModel(modelId);
	};

	const handleLocalProbeSuccess = (result: LocalProbeResult) => {
		if (result.models && result.models.length > 0) {
			setAvailableModels((prev) => {
				const existing = new Set(prev.map((m) => m.id));
				const additions = result.models
					.filter((id) => !existing.has(id))
					.map((id) => ({ id, label: id }));
				return additions.length > 0 ? [...additions, ...prev] : prev;
			});
		}
	};

	const updateLength = (commentLength: CommentLength) => {
		setStatus('');
		persist({ commentLength });
	};

	const updateProfileSummary = (profileSummary: string) => {
		setStatus('');
		persist({ profileSummary });
	};

	const updatePromotionalMessage = (promotionalMessage: string) => {
		setStatus('');
		persist({ promotionalMessage });
	};

	const handlePromotionalKeyDown = (
		event: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		if (event.key === 'Tab' && !event.shiftKey) {
			event.preventDefault();
			const textarea = event.currentTarget;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const currentValue = textarea.value;
			const tabChar = '\t';

			if (
				currentValue.length + tabChar.length - (end - start) >
				MAX_PROMOTIONAL_MESSAGE_LENGTH
			) {
				return;
			}

			const nextValue =
				currentValue.substring(0, start) + tabChar + currentValue.substring(end);
			updatePromotionalMessage(nextValue);

			requestAnimationFrame(() => {
				textarea.selectionStart = textarea.selectionEnd =
					start + tabChar.length;
			});
		}
	};

	return (
		<main className="flex flex-col w-90 min-h-125 max-h-150 bg-background text-foreground">
			<header className="shrink-0 bg-primary px-4 py-3 text-primary-foreground">
				<div className="flex items-start gap-2.5">
					<img
						src="/icons/icon48.png"
						alt=""
						className="mt-0.5 h-9 w-9 shrink-0 rounded-xl shadow-sm ring-1 ring-primary-foreground/20 outline -outline-offset-1 outline-black/10"
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
												className="shrink-0 gap-1 rounded-full bg-linear-to-r from-pink-500 to-rose-500 px-2.5 text-[10px] font-bold text-white shadow-sm shadow-pink-500/30 hover:from-pink-600 hover:to-rose-600 transition-[background,box-shadow,scale] active:scale-[0.96] animate-pulse"
											/>
										}>
										<Heart className="h-3 w-3 fill-current" />
										Donate
									</DialogTrigger>
									<DialogContent className="max-w-75 p-5">
										<DialogHeader>
											<DialogTitle className="text-center text-base font-bold text-balance">
												Support via UPI
											</DialogTitle>
										</DialogHeader>
										<div className="flex flex-col items-center gap-3">
											<div className="overflow-hidden rounded-xl border border-border bg-white p-2">
												<img
													src="/icons/Roni-upi-qr-code.png"
													alt="UPI QR Code"
													className="h-48 w-48 object-contain rounded-lg outline -outline-offset-1 outline-black/10"
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
						{(() => {
							const shortProvider =
								settings.provider === 'custom'
									? /:(?:4096|4097|4098)\b/i.test(settings.customApiBase ?? '')
										? 'OpenCode'
										: 'Custom'
									: currentProvider.label;
							const modelName = getModelLabel(
								settings.provider,
								settings.model,
								availableModels,
							);
							const fullBadgeText = `${shortProvider} / ${modelName}`;

							return (
								<span
									title={fullBadgeText}
									className="mt-1.5 inline-flex max-w-full items-center rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-medium text-primary-foreground/75 tabular-nums"
								>
									<span className="truncate">{fullBadgeText}</span>
								</span>
							);
						})()}
					</div>
				</div>
			</header>

			<div className="flex flex-1 flex-col min-h-0 overflow-y-auto">
				{loading ?
					<div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading settings…
					</div>
				:	<Tabs
						value={activeTab}
						onValueChange={(value) =>
							setActiveTab(value as 'settings' | 'history')
						}>
						<TabsList className="flex w-full border-b border-border bg-transparent gap-0 p-0 h-auto shrink-0">
							<TabsTrigger
								value="settings"
								className="relative flex-1 flex items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-foreground data-active:text-foreground data-active:border-foreground data-active:bg-transparent rounded-none shadow-none transition-[color,border-color] hover:text-foreground">
								<Settings className="h-3.5 w-3.5" />
								Settings
							</TabsTrigger>
							<TabsTrigger
								value="history"
								className="relative flex-1 flex items-center justify-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-xs font-semibold text-muted-foreground data-active:text-foreground data-active:border-foreground data-active:bg-transparent rounded-none shadow-none transition-[color,border-color] hover:text-foreground">
								<History className="h-3.5 w-3.5" />
								History
							</TabsTrigger>
						</TabsList>

						<TabsContent
							value="settings"
							className="m-0 space-y-4 p-4">
							{/* Provider & Model selectors */}
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-semibold text-foreground">
										AI provider &amp; model
									</Label>
									<button
										type="button"
										onClick={() =>
											void loadModels(
												settings.provider,
												settings.apiKeys[settings.provider],
												settings.customApiBase,
												true,
											)
										}
										disabled={loadingModels}
										title="Refresh available models from provider"
										className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer">
										<RotateCw
											className={`h-3 w-3 ${loadingModels ? 'animate-spin' : ''}`}
										/>
										Refresh
									</button>
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<Select
											value={settings.provider}
											items={providerItems}
											onValueChange={(val) => {
												if (val) updateProvider(val as LlmProvider);
											}}>
											<SelectTrigger
												id="provider-select"
												aria-label="Select AI provider">
												<SelectValue placeholder="Select provider" />
											</SelectTrigger>
											<SelectContent align="start">
												{providerItems.map((p) => (
													<SelectItem key={p.value} value={p.value}>
														{p.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div>
										{manualModelInput ?
											<div className="flex gap-1">
												<input
													id="model-input"
													type="text"
													value={settings.model}
													onChange={(e) => updateModel(e.target.value)}
													placeholder="Model ID (e.g. llama3.2)"
													className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-mono text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
												/>
												<button
													type="button"
													onClick={() => setManualModelInput(false)}
													title="Switch to dropdown list"
													className="shrink-0 rounded px-1.5 text-[10px] font-semibold text-primary hover:underline cursor-pointer">
													List
												</button>
											</div>
										:	<Select
												value={settings.model}
												items={modelItems}
												disabled={loadingModels && displayModels.length === 0}
												onValueChange={(val) => {
													if (val === '__manual__') {
														setManualModelInput(true);
													} else if (val) {
														updateModel(val);
													}
												}}>
												<SelectTrigger
													id="model-select"
													aria-label="Select model"
													isLoading={loadingModels}>
													<SelectValue placeholder="Select model" />
												</SelectTrigger>
												<SelectContent align="end">
													{settings.model &&
														!displayModels.some((m) => m.id === settings.model) &&
														settings.model !== '__manual__' && (
															<SelectItem value={settings.model}>
																{getModelLabel(settings.provider, settings.model)}
															</SelectItem>
														)}
													{displayModels.map((m) => (
														<SelectItem key={m.id} value={m.id}>
															{m.label}
														</SelectItem>
													))}
													<SelectSeparator />
													<SelectItem value="__manual__">
														<span className="flex items-center gap-1.5 text-muted-foreground">
															<span>✏️</span>
															<span>Type model name...</span>
														</span>
													</SelectItem>
												</SelectContent>
											</Select>
										}
									</div>
								</div>

								{(settings.provider === 'ollama' ||
									settings.provider === 'custom') && (
									<div className="space-y-2">
										<div className="space-y-1.5 rounded-lg border border-border/80 bg-muted/40 p-2.5">
											<div className="flex items-center justify-between">
												<Label
													htmlFor="custom-endpoint-url"
													className="text-xs font-semibold text-foreground">
													{settings.provider === 'ollama' ?
														'Ollama API URL'
													:	'API Endpoint URL'}
												</Label>
												<span className="text-[10px] text-muted-foreground font-mono">
													{settings.provider === 'ollama' ?
														':11434/v1'
													:	'OpenCode / OpenAI-compat'}
												</span>
											</div>
											<div className="flex gap-1.5">
												<input
													id="custom-endpoint-url"
													type="url"
													value={
														settings.customApiBase ??
														(settings.provider === 'ollama' ?
															'http://localhost:11434/v1'
														:	'http://localhost:4096')
													}
													onChange={(e) => updateCustomApiBase(e.target.value)}
													placeholder={
														settings.provider === 'ollama' ?
															'http://localhost:11434/v1'
														:	'http://localhost:4096'
													}
													className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs font-mono text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-ring/20"
												/>
												<Button
													type="button"
													size="xs"
													variant="outline"
													onClick={() =>
														void loadModels(
															settings.provider,
															settings.apiKeys[settings.provider],
															settings.customApiBase,
															true,
														)
													}
													disabled={loadingModels}
													className="h-8 shrink-0 px-2.5 text-[11px] font-medium">
													{loadingModels ?
														<Loader2 className="h-3 w-3 animate-spin" />
													:	'Connect'}
												</Button>
											</div>

											{settings.provider === 'custom' && (
												<div className="space-y-1 pt-0.5">
													<div className="flex flex-wrap items-center gap-1">
														<span className="text-[10px] font-medium text-muted-foreground">
															Presets:
														</span>
														<button
															type="button"
															onClick={() =>
																applyCustomPreset('http://localhost:4096')
															}
															className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/60 hover:bg-muted cursor-pointer transition-colors shadow-2xs">
															OpenCode (4096)
														</button>
														<button
															type="button"
															onClick={() =>
																applyCustomPreset('http://localhost:1234/v1')
															}
															className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/60 hover:bg-muted cursor-pointer transition-colors shadow-2xs">
															LM Studio (1234)
														</button>
														<button
															type="button"
															onClick={() =>
																applyCustomPreset('http://localhost:11434/v1')
															}
															className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/60 hover:bg-muted cursor-pointer transition-colors shadow-2xs">
															Ollama (11434)
														</button>
														<button
															type="button"
															onClick={() =>
																applyCustomPreset('http://localhost:8080/v1')
															}
															className="rounded bg-background px-1.5 py-0.5 text-[10px] font-medium text-foreground/80 border border-border/60 hover:bg-muted cursor-pointer transition-colors shadow-2xs">
															LocalAI (8080)
														</button>
													</div>
													<p className="text-[10px] text-muted-foreground leading-tight">
														For OpenCode serve, paste the server password as the
														API key.
													</p>
												</div>
											)}
										</div>

										<LocalAiStatus
											provider={settings.provider}
											customApiBase={settings.customApiBase}
											selectedModel={settings.model}
											onSelectModel={handleSelectModelFromLocal}
											onProbeSuccess={handleLocalProbeSuccess}
										/>
									</div>
								)}

								{modelsNotice && (
									<p className="text-[10px] text-muted-foreground leading-tight">
										{modelsNotice}
									</p>
								)}
								{API_KEY_URLS[settings.provider] && (
									<a
										href={API_KEY_URLS[settings.provider]}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline transition-colors">
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
								isOptional={
									settings.provider === 'ollama' ||
									settings.provider === 'custom'
								}
								onSave={saveApiKey}
							/>

							<Separator />

							<ToneSelector
								value={settings.defaultTone}
								customTones={settings.customTones}
								onChange={updateTone}
							/>
							<CustomTones
								customTones={settings.customTones || []}
								onChange={updateCustomTones}
							/>
							<LengthSelector
								value={settings.commentLength}
								onChange={updateLength}
							/>

							<div className="space-y-2">
								<div className="flex items-end justify-between gap-3">
									<Label
										htmlFor="profile-summary"
										className="text-sm font-semibold text-foreground">
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

							<StyleExamples
								styleExamples={settings.styleExamples || []}
								onChange={updateStyleExamples}
							/>

							<Separator />

							<div className="space-y-2">
								<div className="flex items-end justify-between gap-3">
									<Label
										htmlFor="promotional-message"
										className="text-sm font-semibold text-foreground">
										Promotional message
									</Label>
									<span className="text-[10px] font-medium text-muted-foreground text-pretty">
										Appended to every comment
									</span>
								</div>
								<Textarea
									id="promotional-message"
									value={settings.promotionalMessage}
									onChange={(event) =>
										updatePromotionalMessage(event.target.value)
									}
									onKeyDown={handlePromotionalKeyDown}
									placeholder="Example: 🔗 Check out my newsletter: https://your-link.com"
									rows={3}
									maxLength={MAX_PROMOTIONAL_MESSAGE_LENGTH}
									className="text-xs whitespace-pre-wrap"
									style={{ tabSize: 2 }}
								/>
								<div className="flex items-start justify-between gap-3">
									<p className="text-[10px] text-muted-foreground leading-relaxed">
										Appended to your comment. Add Enter, Tab, or Spacebar to customize spacing.
									</p>
									<span className="shrink-0 text-[10px] font-medium text-muted-foreground tabular-nums">
										{settings.promotionalMessage.length}/
										{MAX_PROMOTIONAL_MESSAGE_LENGTH}
									</span>
								</div>
							</div>

							<p
								className="min-h-4 text-center text-xs text-muted-foreground"
								role="status">
								{status}
							</p>
						</TabsContent>

						<TabsContent
							value="history"
							className="m-0 p-4">
							<HistoryTab />
						</TabsContent>
					</Tabs>
				}
			</div>
			<Footer />
		</main>
	);
}
