import type { HistoryEntry, UserSettings } from "./types"

const SETTINGS_KEY = "settings"
const HISTORY_KEY = "history"
const MAX_HISTORY_ENTRIES = 50

export const DEFAULT_SETTINGS: UserSettings = {
  apiKey: "",
  provider: "gemini",
  defaultTone: "professional",
  commentLength: "medium",
}

export async function getSettings(): Promise<UserSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY)
  const settings = stored[SETTINGS_KEY] as Partial<UserSettings> | undefined

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const stored = await chrome.storage.local.get(HISTORY_KEY)
  const history = stored[HISTORY_KEY]
  return Array.isArray(history) ? (history as HistoryEntry[]) : []
}

export async function addHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await getHistory()
  const nextHistory = [entry, ...history.filter((item) => item.id !== entry.id)].slice(
    0,
    MAX_HISTORY_ENTRIES,
  )
  await chrome.storage.local.set({ [HISTORY_KEY]: nextHistory })
}
