import type { HistoryEntry, LlmProvider, UserSettings } from './types';

const SETTINGS_KEY = 'settings';
const HISTORY_KEY = 'history';
const MAX_HISTORY_ENTRIES = 50;

export const DEFAULT_SETTINGS: UserSettings = {
	apiKeys: {
		gemini: '',
		openrouter: '',
	},
	provider: 'gemini',
	defaultTone: 'professional',
	commentLength: 'medium',
	profileSummary: '',
	promptPreferences: {
		avoidBuzzwords: true,
		avoidCliches: true,
		avoidAIGenerated: true,
		preferFreshAngles: true,
	},
};

function normalizePromptPreferences(
	promptPreferences: Partial<UserSettings['promptPreferences']> | undefined,
): UserSettings['promptPreferences'] {
	return {
		...DEFAULT_SETTINGS.promptPreferences,
		...promptPreferences,
	};
}

function normalizeApiKeys(
	apiKeys: Partial<Record<LlmProvider, string>> | undefined,
	provider: LlmProvider,
	legacyApiKey: string | undefined,
): UserSettings['apiKeys'] {
	const nextKeys = {
		...DEFAULT_SETTINGS.apiKeys,
		...apiKeys,
	};

	if (legacyApiKey && !nextKeys[provider]) {
		nextKeys[provider] = legacyApiKey;
	}

	return nextKeys;
}

export async function getSettings(): Promise<UserSettings> {
	const stored = await chrome.storage.local.get(SETTINGS_KEY);
	const settings = stored[SETTINGS_KEY] as Partial<UserSettings> | undefined;

	const provider = settings?.provider ?? DEFAULT_SETTINGS.provider;

	return {
		...DEFAULT_SETTINGS,
		...settings,
		provider,
		profileSummary: settings?.profileSummary ?? DEFAULT_SETTINGS.profileSummary,
		promptPreferences: normalizePromptPreferences(settings?.promptPreferences),
		apiKeys: normalizeApiKeys(
			settings?.apiKeys,
			provider,
			(settings as { apiKey?: string } | undefined)?.apiKey,
		),
	};
}

export async function saveSettings(settings: UserSettings): Promise<void> {
	await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
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
