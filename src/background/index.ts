import { logger } from '../lib/logger';
import { generateComments } from '../lib/llm/provider';
import { fetchLiveModels } from '../lib/llm/model-fetcher';
import { getDefaultModels } from '../lib/llm/registry';
import {
	addHistoryEntry,
	clearHistory,
	deleteHistoryEntry,
	getCachedModels,
	getHistory,
	getSettings,
	setCachedModels,
} from '../lib/storage';
import type {
	ClearHistoryResponse,
	CommentRequest,
	DeleteHistoryEntryResponse,
	FetchModelsMessage,
	FetchModelsResponse,
	GenerateCommentsFailure,
	GenerateCommentsMessage,
	GenerateCommentsResponse,
	GetSettingsMessage,
	GetSettingsResponse,
	LlmProvider,
} from '../lib/types';
import { LlmProviderError } from '../lib/types';

const validLengths = new Set(['short', 'medium', 'long']);
const validProviders = new Set<string>([
	'gemini',
	'openai',
	'anthropic',
	'openrouter',
	'deepseek',
	'perplexity',
	'xai',
	'ollama',
	'custom',
]);

function isCommentRequest(value: unknown): value is CommentRequest {
	if (!value || typeof value !== 'object') return false;
	const request = value as Record<string, unknown>;
	return (
		typeof request.postText === 'string' &&
		request.postText.trim().length > 0 &&
		request.postText.length <= 12_000 &&
		typeof request.tone === 'string' &&
		request.tone.trim().length > 0 &&
		typeof request.length === 'string' &&
		validLengths.has(request.length) &&
		(request.authorName === undefined || typeof request.authorName === 'string') &&
		(request.customDirective === undefined || typeof request.customDirective === 'string')
	);
}

function isGenerateMessage(value: unknown): value is GenerateCommentsMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	return (
		message.action === 'GENERATE_COMMENTS' && isCommentRequest(message.payload)
	);
}

function isGetSettingsMessage(value: unknown): value is GetSettingsMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	return message.action === 'GET_SETTINGS';
}

function isFetchModelsMessage(value: unknown): value is FetchModelsMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	if (message.action !== 'FETCH_MODELS') return false;
	if (!message.payload || typeof message.payload !== 'object') return false;
	const payload = message.payload as Record<string, unknown>;
	return (
		typeof payload.provider === 'string' &&
		validProviders.has(payload.provider) &&
		(payload.apiKey === undefined || typeof payload.apiKey === 'string') &&
		(payload.customApiBase === undefined || typeof payload.customApiBase === 'string') &&
		(payload.forceRefresh === undefined || typeof payload.forceRefresh === 'boolean')
	);
}

async function handleFetchModels(
	provider: LlmProvider,
	providedApiKey?: string,
	providedCustomApiBase?: string,
	forceRefresh = false,
): Promise<FetchModelsResponse> {
	const fallbackModels = getDefaultModels(provider);

	try {
		if (!forceRefresh) {
			const cached = await getCachedModels(provider);
			if (cached && cached.length > 0) {
				return { ok: true, models: cached };
			}
		}

		let apiKey = providedApiKey;
		let customApiBase = providedCustomApiBase;
		if (!apiKey || (!customApiBase && (provider === 'custom' || provider === 'ollama'))) {
			const settings = await getSettings();
			if (!apiKey) {
				apiKey = settings.apiKeys[provider] ?? '';
			}
			if (!customApiBase) {
				customApiBase = settings.customApiBase;
			}
		}

		const models = await fetchLiveModels(provider, apiKey, customApiBase);
		if (models && models.length > 0) {
			await setCachedModels(provider, models);
			return { ok: true, models };
		}
		return { ok: true, models: fallbackModels };
	} catch (error) {
		logger.warn('Failed to fetch live models, falling back to defaults.', {
			provider,
			error: error instanceof Error ? error.message : 'Unknown',
		});
		return {
			ok: false,
			error: {
				code: error instanceof LlmProviderError ? error.code : 'UNKNOWN_ERROR',
				message: error instanceof Error ? error.message : 'Could not fetch models.',
			},
			models: fallbackModels,
		};
	}
}

function toFailure(error: unknown): GenerateCommentsFailure {
	if (error instanceof LlmProviderError) {
		return {
			ok: false,
			error: {
				code: error.code,
				message: error.message,
				retryAfter: error.retryAfter,
			},
		};
	}

	return {
		ok: false,
		error: {
			code: 'UNKNOWN_ERROR',
			message: 'An unexpected error occurred while generating comments.',
		},
	};
}

/**
 * Validates that a message sender belongs to this extension.
 * Accepts messages from content scripts, the popup, and the extension itself.
 */
function isTrustedSender(sender: chrome.runtime.MessageSender): boolean {
	return sender.id === chrome.runtime.id;
}

async function handleGenerate(
	request: CommentRequest,
): Promise<GenerateCommentsResponse> {
	try {
		const settings = await getSettings();
		const history = await getHistory();
		const variants = await generateComments(request, settings, history);

		try {
			await addHistoryEntry({
				id: crypto.randomUUID(),
				postText: request.postText,
				authorName: request.authorName,
				tone: request.tone,
				length: request.length,
				variants,
				timestamp: Date.now(),
			});
		} catch (error) {
			logger.warn('Could not save history entry.', {
				error: error instanceof Error ? error.message : 'Unknown',
			});
		}

		return { ok: true, variants };
	} catch (error) {
		return toFailure(error);
	}
}

chrome.runtime.onMessage.addListener(
	(message: unknown, sender, sendResponse) => {
		// Security: only accept messages from this extension
		if (!isTrustedSender(sender)) {
			logger.warn('Rejected message from untrusted sender.', {
				senderId: sender.id,
				senderUrl: sender.url,
			});
			return false;
		}

		if (!message || typeof message !== 'object') return false;
		const candidate = message as Record<string, unknown>;

		if (candidate.action === 'GET_SETTINGS') {
			if (!isGetSettingsMessage(message)) {
				return false;
			}

			logger.debug('Handling GET_SETTINGS.');
			void getSettings()
				.then((settings) => {
					sendResponse({ settings } satisfies GetSettingsResponse);
				})
				.catch((error: unknown) => {
					logger.error('GET_SETTINGS failed.', {
						error: error instanceof Error ? error.message : 'Unknown',
					});
					sendResponse(toFailure(error));
				});
			return true;
		}

		if (candidate.action === 'DELETE_HISTORY_ENTRY') {
			if (typeof candidate.payload !== 'object' || !candidate.payload || typeof (candidate.payload as Record<string, unknown>).id !== 'string') {
				return false;
			}
			const id = (candidate.payload as Record<string, unknown>).id as string;
			logger.debug('Handling DELETE_HISTORY_ENTRY.', { id });
			void deleteHistoryEntry(id)
				.then(() => sendResponse({ ok: true } satisfies DeleteHistoryEntryResponse))
				.catch((error: unknown) => sendResponse(toFailure(error)));
			return true;
		}

		if (candidate.action === 'CLEAR_HISTORY') {
			logger.debug('Handling CLEAR_HISTORY.');
			void clearHistory()
				.then(() => sendResponse({ ok: true } satisfies ClearHistoryResponse))
				.catch((error: unknown) => sendResponse(toFailure(error)));
			return true;
		}

		if (candidate.action === 'FETCH_MODELS') {
			if (!isFetchModelsMessage(message)) {
				sendResponse({
					ok: false,
					error: {
						code: 'INVALID_REQUEST',
						message: 'Invalid FETCH_MODELS message payload.',
					},
					models: [],
				} satisfies FetchModelsResponse);
				return true;
			}

			logger.debug('Handling FETCH_MODELS.', {
				provider: message.payload.provider,
				forceRefresh: message.payload.forceRefresh,
			});
			void handleFetchModels(
				message.payload.provider,
				message.payload.apiKey,
				message.payload.customApiBase,
				message.payload.forceRefresh,
			).then(sendResponse);
			return true;
		}

		if (candidate.action !== 'GENERATE_COMMENTS') return false;

		if (!isGenerateMessage(message)) {
			logger.warn('Rejected invalid GENERATE_COMMENTS payload.');
			sendResponse({
				ok: false,
				error: {
			code: 'INVALID_REQUEST',
			message: 'The comment request was invalid.',
				},
			} satisfies GenerateCommentsFailure);
			// Return true so Chrome knows we called sendResponse asynchronously
			return true;
		}

		logger.info('Handling GENERATE_COMMENTS.', {
			tone: message.payload.tone,
			length: message.payload.length,
			postTextLength: message.payload.postText.length,
		});

		void handleGenerate(message.payload)
			.then(sendResponse)
			.catch((error: unknown) => {
				logger.error('GENERATE_COMMENTS failed unexpectedly.', {
					error: error instanceof Error ? error.message : 'Unknown',
				});
				sendResponse(toFailure(error));
			});
		return true;
	},
);
