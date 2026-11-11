export type Tone = 'professional' | 'witty' | 'supportive';

export const BUILTIN_TONES = ['professional', 'witty', 'supportive'] as const;

export interface CustomTone {
	id: string;
	label: string;
	prompt: string;
}

export type CommentLength = 'short' | 'medium' | 'long';

export interface ModelConfig {
	id: string;
	label: string;
}

export type LlmProvider =
	| 'gemini'
	| 'openai'
	| 'anthropic'
	| 'openrouter'
	| 'deepseek'
	| 'perplexity'
	| 'xai'
	| 'ollama'
	| 'custom';

export interface PromptPreferences {
	avoidBuzzwords: boolean;
	avoidCliches: boolean;
	avoidAIGenerated: boolean;
	preferFreshAngles: boolean;
}

export type ProviderApiKeys = Partial<Record<LlmProvider, string>>;

export interface UserSettings {
	apiKeys: ProviderApiKeys;
	provider: LlmProvider;
	model: string;
	customApiBase?: string;
	defaultTone: string;
	commentLength: CommentLength;
	profileSummary: string;
	promptPreferences: PromptPreferences;
	customTones: CustomTone[];
	styleExamples: string[];
	promotionalMessage: string;
	anonymizeAuthorName?: boolean;
}

export interface CommentRequest {
	postText: string;
	authorName?: string;
	postUrl?: string;
	postUrn?: string;
	postDate?: string;
	postTimestamp?: number;
	tone: string;
	length: string;
	customDirective?: string;
}

export interface CommentVariant {
	tone: string;
	text: string;
	congratulation: boolean;
}

export interface HistoryEntry {
	id: string;
	postText: string;
	authorName?: string;
	postUrl?: string;
	postUrn?: string;
	postDate?: string;
	postTimestamp?: number;
	provider?: string;
	model?: string;
	tone?: string;
	length?: string;
	variants: CommentVariant[];
	timestamp: number;
}

export interface GenerateCommentsMessage {
	action: 'GENERATE_COMMENTS';
	payload: CommentRequest;
}

export interface GetSettingsMessage {
	action: 'GET_SETTINGS';
}

export interface GetSettingsResponse {
	settings: UserSettings;
}

export interface DeleteHistoryEntryMessage {
	action: 'DELETE_HISTORY_ENTRY';
	payload: { id: string };
}

export interface ClearHistoryMessage {
	action: 'CLEAR_HISTORY';
}

export interface DeleteHistoryEntryResponse {
	ok: true;
}

export interface ClearHistoryResponse {
	ok: true;
}

export interface FetchModelsMessage {
	action: 'FETCH_MODELS';
	payload: {
		provider: LlmProvider;
		apiKey?: string;
		customApiBase?: string;
		forceRefresh?: boolean;
	};
}

export interface FetchModelsSuccess {
	ok: true;
	models: ModelConfig[];
}

export interface FetchModelsFailure {
	ok: false;
	error: {
		code: ErrorCode;
		message: string;
	};
	models: ModelConfig[];
}

export type FetchModelsResponse = FetchModelsSuccess | FetchModelsFailure;

export interface GenerateCommentsSuccess {
	ok: true;
	variants: CommentVariant[];
}

export type ErrorCode =
	| 'MISSING_API_KEY'
	| 'INVALID_API_KEY'
	| 'RATE_LIMITED'
	| 'NETWORK_ERROR'
	| 'OFFLINE'
	| 'INVALID_RESPONSE'
	| 'INVALID_REQUEST'
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
