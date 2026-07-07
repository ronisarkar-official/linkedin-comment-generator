import type { HistoryEntry, LlmProvider, ProviderApiKeys, UserSettings } from './types';

const SETTINGS_KEY = 'settings';
const HISTORY_KEY = 'history';
const MAX_HISTORY_ENTRIES = 50;

const VALID_PROVIDERS = new Set<string>([
	'gemini', 'openai', 'anthropic', 'openrouter', 'groq',
	'together', 'mistral', 'deepseek', 'cohere', 'perplexity', 'xai',
]);

export const DEFAULT_SETTINGS: UserSettings = {
	apiKeys: {},
	provider: 'gemini',
	model: 'gemini-2.5-flash',
	defaultTone: 'professional',
	commentLength: 'medium',
	profileSummary: '',
	promptPreferences: {
		avoidBuzzwords: true,
		avoidCliches: true,
		avoidAIGenerated: true,
		preferFreshAngles: true,
	},
	customTones: [],
	styleExamples: [],
};

function normalizePromptPreferences(
	promptPreferences: Partial<UserSettings['promptPreferences']> | undefined,
): UserSettings['promptPreferences'] {
	return {
		...DEFAULT_SETTINGS.promptPreferences,
		...promptPreferences,
	};
}

/**
 * Migrate from various legacy formats to the current per-provider apiKeys map.
 * Handles: old `apiKeys: { gemini: '', openrouter: '' }` format,
 *          old single `apiKey` string format.
 */
function normalizeApiKeys(
	stored: Record<string, unknown>,
	provider: LlmProvider,
): ProviderApiKeys {
	// Current format: apiKeys as a Record<string, string>
	if (stored.apiKeys && typeof stored.apiKeys === 'object' && !Array.isArray(stored.apiKeys)) {
		const keys = stored.apiKeys as Record<string, string>;
		const result: ProviderApiKeys = {};
		for (const [key, value] of Object.entries(keys)) {
			if (typeof value === 'string' && value.trim()) {
				result[key as LlmProvider] = value;
			}
		}
		return result;
	}

	// Legacy single apiKey string — assign it to the current provider
	if (typeof stored.apiKey === 'string' && stored.apiKey.trim()) {
		return { [provider]: stored.apiKey } as ProviderApiKeys;
	}

	return {};
}

function normalizeProvider(value: unknown): LlmProvider {
	if (typeof value === 'string' && VALID_PROVIDERS.has(value)) {
		return value as LlmProvider;
	}
	return DEFAULT_SETTINGS.provider;
}

export async function getSettings(): Promise<UserSettings> {
	const localStored = await chrome.storage.local.get(SETTINGS_KEY);
	let syncStored: Record<string, unknown> = {};
	try {
		syncStored = await chrome.storage.sync.get(SETTINGS_KEY);
	} catch {
		// Ignore sync storage errors
	}

	const localSettings = localStored[SETTINGS_KEY] as Record<string, unknown> | undefined;
	const syncSettings = syncStored[SETTINGS_KEY] as Record<string, unknown> | undefined;
	const settings = { ...localSettings, ...syncSettings } as Record<string, unknown>;

	const provider = normalizeProvider(settings.provider);
	const apiKeys = normalizeApiKeys(localSettings ?? {}, provider);

	// Strip legacy top-level apiKey property if present
	delete settings.apiKey;

	return {
		...DEFAULT_SETTINGS,
		...(settings as Partial<UserSettings>),
		provider,
		model: typeof settings.model === 'string' && settings.model.trim()
			? settings.model as string
			: DEFAULT_SETTINGS.model,
		profileSummary: typeof settings.profileSummary === 'string'
			? settings.profileSummary
			: DEFAULT_SETTINGS.profileSummary,
		promptPreferences: normalizePromptPreferences(
			settings.promptPreferences as Partial<UserSettings['promptPreferences']> | undefined,
		),
		customTones: Array.isArray(settings.customTones) ? settings.customTones : DEFAULT_SETTINGS.customTones,
		styleExamples: Array.isArray(settings.styleExamples) ? settings.styleExamples : DEFAULT_SETTINGS.styleExamples,
		apiKeys,
	};
}

export async function saveSettings(settings: UserSettings): Promise<void> {
	// Ensure no legacy top-level apiKey property is saved
	const { apiKey: _legacyKey, ...cleanSettings } = settings as unknown as Record<string, unknown>;
	await chrome.storage.local.set({ [SETTINGS_KEY]: cleanSettings });
	try {
		const { apiKeys, apiKey: _legacySyncKey, ...syncableSettings } = cleanSettings;
		await chrome.storage.sync.set({ [SETTINGS_KEY]: syncableSettings });
	} catch {
		// Ignore sync storage errors
	}
}

export async function getHistory(): Promise<HistoryEntry[]> {
	const stored = await chrome.storage.local.get(HISTORY_KEY);
	const history = stored[HISTORY_KEY];
	return Array.isArray(history) ? (history as HistoryEntry[]) : [];
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
	const history = await getHistory();
	const nextHistory = [
		entry,
		...history.filter((item) => item.id !== entry.id),
	].slice(0, MAX_HISTORY_ENTRIES);
	await chrome.storage.local.set({ [HISTORY_KEY]: nextHistory });
}

export async function deleteHistoryEntry(id: string): Promise<void> {
	const history = await getHistory();
	const nextHistory = history.filter((item) => item.id !== id);
	await chrome.storage.local.set({ [HISTORY_KEY]: nextHistory });
}

export async function clearHistory(): Promise<void> {
	await chrome.storage.local.remove(HISTORY_KEY);
}
