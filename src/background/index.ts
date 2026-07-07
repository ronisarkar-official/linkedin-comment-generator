import { logger } from '../lib/logger';
import { generateComments } from '../lib/llm/provider';
import { addHistoryEntry, clearHistory, deleteHistoryEntry, getHistory, getSettings } from '../lib/storage';
import type {
	ClearHistoryResponse,
	CommentRequest,
	DeleteHistoryEntryResponse,
	GenerateCommentsFailure,
	GenerateCommentsMessage,
	GenerateCommentsResponse,
	GetSettingsMessage,
	GetSettingsResponse,
} from '../lib/types';
import { LlmProviderError } from '../lib/types';

const validLengths = new Set(['short', 'medium', 'long']);

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

		if (candidate.action !== 'GENERATE_COMMENTS') return false;

		if (!isGenerateMessage(message)) {
			logger.warn('Rejected invalid GENERATE_COMMENTS payload.');
			sendResponse({
				ok: false,
				error: {
					code: 'INVALID_RESPONSE',
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
