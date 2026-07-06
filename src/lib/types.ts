export type Tone = 'professional' | 'witty' | 'supportive';

export type CommentLength = 'short' | 'medium' | 'long';

export type LlmProvider = 'gemini' | 'openrouter';

export interface UserSettings {
	apiKey: string;
	provider: LlmProvider;
	defaultTone: Tone;
	commentLength: CommentLength;
}

export interface CommentRequest {
	postText: string;
	authorName?: string;
	tone: Tone;
	length: string;
}

export interface CommentVariant {
	tone: Tone;
	text: string;
	congratulation: boolean;
}

export interface HistoryEntry {
	id: string;
	postText: string;
	variants: CommentVariant[];
	timestamp: number;
}

export interface GenerateCommentsMessage {
	action: 'GENERATE_COMMENTS';
	payload: CommentRequest;
}

export interface GenerateCommentsSuccess {
	ok: true;
	variants: CommentVariant[];
}

export type ErrorCode =
	| 'MISSING_API_KEY'
	| 'INVALID_API_KEY'
	| 'RATE_LIMITED'
	| 'NETWORK_ERROR'
	| 'INVALID_RESPONSE'
	| 'PROVIDER_ERROR'
	| 'UNKNOWN_ERROR';

export interface GenerateCommentsFailure {
	ok: false;
	error: {
		code: ErrorCode;
		message: string;
		retryAfter?: number;
	};
}

export type GenerateCommentsResponse =
	| GenerateCommentsSuccess
	| GenerateCommentsFailure;

export class LlmProviderError extends Error {
	readonly code: ErrorCode;
	readonly retryAfter?: number;

	constructor(code: ErrorCode, message: string, retryAfter?: number) {
		super(message);
		this.name = 'LlmProviderError';
		this.code = code;
		this.retryAfter = retryAfter;
	}
}
