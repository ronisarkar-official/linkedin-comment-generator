import { logger } from './logger';
import type { CustomTone, HistoryEntry, LlmProvider, ProviderApiKeys, UserSettings } from './types';

const SETTINGS_KEY = 'settings';
const HISTORY_KEY = 'history';
export const MAX_HISTORY_ENTRIES = 50;
export const MAX_CUSTOM_TONES = 999;
export const MAX_STYLE_EXAMPLES = 5;

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
			if (typeof value === 'string' && value.trim() && VALID_PROVIDERS.has(key)) {
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

function isValidCustomTone(value: unknown): value is CustomTone {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === 'string' && candidate.id.trim().length > 0 &&
		typeof candidate.label === 'string' && candidate.label.trim().length > 0 &&
		typeof candidate.prompt === 'string' && candidate.prompt.trim().length > 0
	);
}

function normalizeCustomTones(value: unknown): CustomTone[] {
	if (!Array.isArray(value)) return DEFAULT_SETTINGS.customTones;
	return value.filter(isValidCustomTone).slice(0, MAX_CUSTOM_TONES);
}

function normalizeStyleExamples(value: unknown): string[] {
	if (!Array.isArray(value)) return DEFAULT_SETTINGS.styleExamples;
	return value
		.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
		.slice(0, MAX_STYLE_EXAMPLES);
}

function isValidHistoryEntry(value: unknown): value is HistoryEntry {
	if (!value || typeof value !== 'object') return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.id === 'string' && candidate.id.length > 0 &&
		typeof candidate.postText === 'string' &&
		typeof candidate.timestamp === 'number' &&
		Array.isArray(candidate.variants)
	);
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

	// Security: provider and apiKeys must come from local storage only.
	// Sync storage may only provide non-sensitive display preferences.
	const provider = normalizeProvider(localSettings?.provider ?? syncSettings?.provider);
	const apiKeys = normalizeApiKeys(localSettings ?? {}, provider);

	// Merge non-sensitive settings from sync as baseline, then local overrides.
	const mergedPrefs: Record<string, unknown> = {};
	if (syncSettings) {
		for (const [key, val] of Object.entries(syncSettings)) {
			// Never trust sync for security-sensitive fields
			if (key !== 'apiKeys' && key !== 'apiKey' && key !== 'provider') {
				mergedPrefs[key] = val;
			}
		}
	}
	if (localSettings) {
		for (const [key, val] of Object.entries(localSettings)) {
			mergedPrefs[key] = val;
		}
	}

	return {
		apiKeys,
		provider,
		model: typeof mergedPrefs.model === 'string' && mergedPrefs.model.trim()
			? mergedPrefs.model as string
			: DEFAULT_SETTINGS.model,
		defaultTone: typeof mergedPrefs.defaultTone === 'string' && mergedPrefs.defaultTone.trim()
			? mergedPrefs.defaultTone as string
			: DEFAULT_SETTINGS.defaultTone,
		commentLength:
			typeof mergedPrefs.commentLength === 'string' &&
			['short', 'medium', 'long'].includes(mergedPrefs.commentLength as string)
				? mergedPrefs.commentLength as UserSettings['commentLength']
				: DEFAULT_SETTINGS.commentLength,
		profileSummary: typeof mergedPrefs.profileSummary === 'string'
			? mergedPrefs.profileSummary
			: DEFAULT_SETTINGS.profileSummary,
		promptPreferences: normalizePromptPreferences(
			mergedPrefs.promptPreferences as Partial<UserSettings['promptPreferences']> | undefined,
		),
		customTones: normalizeCustomTones(mergedPrefs.customTones),
		styleExamples: normalizeStyleExamples(mergedPrefs.styleExamples),
	};
}

export async function saveSettings(settings: UserSettings): Promise<void> {
	// Enforce bounds before saving
	const bounded: UserSettings = {
		...settings,
		customTones: settings.customTones.slice(0, MAX_CUSTOM_TONES),
		styleExamples: settings.styleExamples.slice(0, MAX_STYLE_EXAMPLES),
	};

	// Ensure no legacy top-level apiKey property is saved
	const { apiKey: _legacyKey, ...cleanSettings } = bounded as unknown as Record<string, unknown>;
	await chrome.storage.local.set({ [SETTINGS_KEY]: cleanSettings });
	try {
		const { apiKeys: _keys, apiKey: _legacySyncKey, provider: _prov, ...syncableSettings } = cleanSettings;
		await chrome.storage.sync.set({ [SETTINGS_KEY]: syncableSettings });
	} catch {
		logger.warn('Could not sync settings to Chrome sync storage.');
	}
}

export async function getHistory(): Promise<HistoryEntry[]> {
	const stored = await chrome.storage.local.get(HISTORY_KEY);
	const history = stored[HISTORY_KEY];
	if (!Array.isArray(history)) return [];
	return history.filter(isValidHistoryEntry);
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
