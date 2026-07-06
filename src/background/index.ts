import { generateComments } from '../lib/llm/provider';
import { addHistoryEntry, getHistory, getSettings } from '../lib/storage';
import type {
	CommentRequest,
	GenerateCommentsFailure,
	GenerateCommentsMessage,
	GenerateCommentsResponse,
	GetSettingsMessage,
	GetSettingsResponse,
	Tone,
} from '../lib/types';
import { LlmProviderError } from '../lib/types';

const validTones = new Set<Tone>(['professional', 'witty', 'supportive']);
const validLengths = new Set(['short', 'medium', 'long']);

function isCommentRequest(value: unknown): value is CommentRequest {
	if (!value || typeof value !== 'object') return false;
	const request = value as Record<string, unknown>;
	return (
		typeof request.postText === 'string' &&
		request.postText.trim().length > 0 &&
		request.postText.length <= 12_000 &&
		typeof request.tone === 'string' &&
		validTones.has(request.tone as Tone) &&
		typeof request.length === 'string' &&
		validLengths.has(request.length) &&
		(request.authorName === undefined || typeof request.authorName === 'string')
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
				variants,
				timestamp: Date.now(),
			});
		} catch (error) {
			console.warn('LinkedIn Comment Generator could not save history.', error);
		}

		return { ok: true, variants };
	} catch (error) {
		return toFailure(error);
	}
}

chrome.runtime.onMessage.addListener(
	(message: unknown, _sender, sendResponse) => {
		if (!message || typeof message !== 'object') return false;
		const candidate = message as Record<string, unknown>;

		if (candidate.action === 'GET_SETTINGS') {
			if (!isGetSettingsMessage(message)) {
				return false;
			}

			void getSettings()
				.then((settings) => {
					sendResponse({ settings } satisfies GetSettingsResponse);
				})
				.catch((error: unknown) => {
					sendResponse(toFailure(error));
				});
			return true;
		}

		if (candidate.action !== 'GENERATE_COMMENTS') return false;

		if (!isGenerateMessage(message)) {
			sendResponse({
				ok: false,
				error: {
					code: 'INVALID_RESPONSE',
					message: 'The comment request was invalid.',
				},
			} satisfies GenerateCommentsFailure);
			return false;
		}

		void handleGenerate(message.payload)
			.then(sendResponse)
			.catch((error: unknown) => {
				sendResponse(toFailure(error));
			});
		return true;
	},
);
