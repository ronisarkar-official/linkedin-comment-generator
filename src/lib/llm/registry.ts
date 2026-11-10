import type { LlmProvider, ModelConfig } from '../types';

export type { ModelConfig };

/**
 * How the provider handles structured JSON output:
 * - 'json_schema': Full OpenAI-style json_schema (OpenAI, Perplexity)
 * - 'json_object': Simple { type: "json_object" } mode (DeepSeek, xAI)
 * - 'none': No response_format support — rely on prompt-based JSON (OpenRouter free models)
 */
export type ResponseFormatType = 'json_schema' | 'json_object' | 'none';

export interface ProviderConfig {
	id: LlmProvider;
	label: string;
	models: ModelConfig[];
	apiBase: string;
	keyPlaceholder: string;
	keyPrefix?: string;
	responseFormat: ResponseFormatType;
}

export const PROVIDERS: ProviderConfig[] = [
	{
		id: 'gemini',
		label: 'Gemini',
		models: [
			{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
			{ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
			{ id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
		],
		apiBase: 'https://generativelanguage.googleapis.com/v1beta',
		keyPlaceholder: 'AIza…',
		responseFormat: 'json_schema',
	},
	{
		id: 'openai',
		label: 'OpenAI',
		models: [
			{ id: 'gpt-4o', label: 'GPT-4o' },
			{ id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
			{ id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
			{ id: 'o3-mini', label: 'o3-mini' },
			{ id: 'o1', label: 'o1' },
		],
		apiBase: 'https://api.openai.com/v1',
		keyPlaceholder: 'sk-…',
		keyPrefix: 'sk-',
		responseFormat: 'json_schema',
	},
	{
		id: 'anthropic',
		label: 'Anthropic',
		models: [
			{ id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
			{ id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
			{ id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
			{ id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
		],
		apiBase: 'https://api.anthropic.com/v1',
		keyPlaceholder: 'sk-ant-…',
		keyPrefix: 'sk-ant-',
		responseFormat: 'none',
	},
	{
		id: 'openrouter',
		label: 'OpenRouter',
		models: [
			{ id: 'openrouter/auto', label: 'Auto Router' },
			{ id: 'openrouter/free', label: 'Free Router' },
			{ id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
			{ id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
			{ id: 'deepseek/deepseek-chat', label: 'DeepSeek V3' },
		],
		apiBase: 'https://openrouter.ai/api/v1',
		keyPlaceholder: 'sk-or-v1-…',
		keyPrefix: 'sk-or-',
		responseFormat: 'none',
	},

	{
		id: 'deepseek',
		label: 'DeepSeek',
		models: [
			{ id: 'deepseek-chat', label: 'DeepSeek Chat (V3)' },
			{ id: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)' },
		],
		apiBase: 'https://api.deepseek.com',
		keyPlaceholder: 'sk-…',
		keyPrefix: 'sk-',
		responseFormat: 'json_object',
	},

	{
		id: 'perplexity',
		label: 'Perplexity',
		models: [
			{ id: 'sonar-pro', label: 'Sonar Pro' },
			{ id: 'sonar', label: 'Sonar' },
			{ id: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
		],
		apiBase: 'https://api.perplexity.ai',
		keyPlaceholder: 'pplx-…',
		keyPrefix: 'pplx-',
		responseFormat: 'json_schema',
	},
	{
		id: 'xai',
		label: 'xAI (Grok)',
		models: [
			{ id: 'grok-2', label: 'Grok 2' },
			{ id: 'grok-2-mini', label: 'Grok 2 Mini' },
			{ id: 'grok-beta', label: 'Grok Beta' },
		],
		apiBase: 'https://api.x.ai/v1',
		keyPlaceholder: 'xai-…',
		keyPrefix: 'xai-',
		responseFormat: 'json_object',
	},
	{
		id: 'ollama',
		label: 'Ollama (Local)',
		models: [
			{ id: 'llama3.2', label: 'Llama 3.2' },
			{ id: 'llama3.1', label: 'Llama 3.1' },
			{ id: 'mistral', label: 'Mistral' },
			{ id: 'gemma2', label: 'Gemma 2' },
			{ id: 'phi4', label: 'Phi 4' },
			{ id: 'qwen2.5', label: 'Qwen 2.5' },
		],
		apiBase: 'http://localhost:11434/v1',
		keyPlaceholder: 'Not required for local models',
		responseFormat: 'json_object',
	},
	{
		id: 'custom',
		label: 'Custom (OpenCode / Local / Proxy)',
		models: [
			{ id: 'default', label: 'Default Model' },
		],
		apiBase: 'http://localhost:4096',
		keyPlaceholder: 'Optional (e.g. OpenCode password or Bearer key)',
		responseFormat: 'json_object',
	},
];

const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]));

/**
 * Safe-character pattern for model IDs.
 * Allows alphanumeric, hyphens, dots, underscores, forward slashes (for
 * namespaced models like "meta-llama/llama-3.3-70b-instruct"), and colons.
 */
const SAFE_MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;

/**
 * Validates that a model ID contains only safe characters and cannot
 * be used for URL path injection when interpolated into an endpoint.
 */
export function validateModelId(modelId: string): string {
	const trimmed = modelId.trim();
	if (!SAFE_MODEL_ID_PATTERN.test(trimmed)) {
		throw new Error(
			`Invalid model ID: "${trimmed.slice(0, 40)}". Model IDs must contain only alphanumeric characters, hyphens, dots, underscores, slashes, and colons.`,
		);
	}
	return trimmed;
}

export function getProvider(id: LlmProvider): ProviderConfig {
	const provider = providerMap.get(id);
	if (!provider) {
		throw new Error(`Unknown provider: ${id}`);
	}
	return provider;
}

export function getDefaultModels(providerId: LlmProvider): ModelConfig[] {
	return getProvider(providerId).models;
}

export function getModelLabel(
	providerId: LlmProvider,
	modelId: string,
	customModels?: ModelConfig[],
): string {
	if (customModels) {
		const match = customModels.find((m) => m.id === modelId);
		if (match) return match.label;
	}
	const provider = getProvider(providerId);
	const model = provider.models.find((m) => m.id === modelId);
	return model?.label ?? modelId;
}
