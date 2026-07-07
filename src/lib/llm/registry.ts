import type { LlmProvider } from '../types';

export interface ModelConfig {
	id: string;
	label: string;
}

/**
 * How the provider handles structured JSON output:
 * - 'json_schema': Full OpenAI-style json_schema (OpenAI, Perplexity, Mistral)
 * - 'json_object': Simple { type: "json_object" } mode (Groq, Together, DeepSeek, Cohere, xAI)
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
			{ id: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
			{ id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
			{ id: 'gpt-5.4-nano', label: 'GPT-5.4 Nano' },
			{ id: 'gpt-4o', label: 'GPT-4o' },
			{ id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
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
			{ id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
			{ id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
			{ id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
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
		id: 'groq',
		label: 'Groq',
		models: [
			{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
			{ id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout' },
			{ id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick' },
			{ id: 'qwen/qwen3-32b', label: 'Qwen 3 32B' },
		],
		apiBase: 'https://api.groq.com/openai/v1',
		keyPlaceholder: 'gsk_…',
		keyPrefix: 'gsk_',
		responseFormat: 'json_object',
	},
	{
		id: 'together',
		label: 'Together',
		models: [
			{ id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B' },
			{ id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B' },
			{ id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
		],
		apiBase: 'https://api.together.xyz/v1',
		keyPlaceholder: 'tok_…',
		responseFormat: 'json_object',
	},
	{
		id: 'mistral',
		label: 'Mistral',
		models: [
			{ id: 'mistral-large-latest', label: 'Mistral Large' },
			{ id: 'mistral-small-latest', label: 'Mistral Small' },
			{ id: 'mistral-medium-latest', label: 'Mistral Medium' },
		],
		apiBase: 'https://api.mistral.ai/v1',
		keyPlaceholder: 'API key…',
		responseFormat: 'json_object',
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
		id: 'cohere',
		label: 'Cohere',
		models: [
			{ id: 'command-a-03-2025', label: 'Command A' },
			{ id: 'command-r-plus-08-2024', label: 'Command R+' },
		],
		apiBase: 'https://api.cohere.com/v2',
		keyPlaceholder: 'API key…',
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
			{ id: 'grok-4.3', label: 'Grok 4.3' },
			{ id: 'grok-4.1', label: 'Grok 4.1 Fast' },
			{ id: 'grok-build-0.1', label: 'Grok Build' },
		],
		apiBase: 'https://api.x.ai/v1',
		keyPlaceholder: 'xai-…',
		keyPrefix: 'xai-',
		responseFormat: 'json_object',
	},
];

const providerMap = new Map(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: LlmProvider): ProviderConfig {
	const provider = providerMap.get(id);
	if (!provider) {
		throw new Error(`Unknown provider: ${id}`);
	}
	return provider;
}

export function getDefaultModel(providerId: LlmProvider): string {
	return getProvider(providerId).models[0].id;
}

export function getProviderLabel(id: LlmProvider): string {
	return getProvider(id).label;
}

export function getModelLabel(providerId: LlmProvider, modelId: string): string {
	const provider = getProvider(providerId);
	const model = provider.models.find((m) => m.id === modelId);
	return model?.label ?? modelId;
}
