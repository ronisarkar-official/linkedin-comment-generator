export type LocalServerType = 'ollama' | 'lmstudio' | 'opencode' | 'custom';

export interface LocalProbeResult {
	ok: boolean;
	serverType: LocalServerType;
	url: string;
	modelCount: number;
	models: string[];
	latencyMs?: number;
	error?: string;
}

export interface LocalModelPreset {
	id: string;
	name: string;
	tag: string;
	size: string;
	description: string;
	ollamaCommand: string;
	recommendedFor: string;
}

export const LOCAL_MODEL_PRESETS: LocalModelPreset[] = [
	{
		id: 'llama3.2:3b',
		name: 'Llama 3.2 3B',
		tag: 'llama3.2:3b',
		size: '2.0 GB',
		description: 'Ultra-fast, low memory footprint. Perfect for snappy LinkedIn comments.',
		ollamaCommand: 'ollama run llama3.2:3b',
		recommendedFor: 'Fast commentary',
	},
	{
		id: 'deepseek-r1:8b',
		name: 'DeepSeek R1 8B',
		tag: 'deepseek-r1:8b',
		size: '4.9 GB',
		description: 'State-of-the-art reasoning model. Generates deep analytical insights.',
		ollamaCommand: 'ollama run deepseek-r1:8b',
		recommendedFor: 'Analytical depth',
	},
	{
		id: 'qwen2.5:7b',
		name: 'Qwen 2.5 7B',
		tag: 'qwen2.5:7b',
		size: '4.7 GB',
		description: 'Superb language nuance, natural tone, and multilingual fluency.',
		ollamaCommand: 'ollama run qwen2.5:7b',
		recommendedFor: 'Professional tone',
	},
	{
		id: 'mistral:7b',
		name: 'Mistral 7B',
		tag: 'mistral:7b',
		size: '4.1 GB',
		description: 'Well-rounded, high-polish writing with natural conversational cadence.',
		ollamaCommand: 'ollama run mistral',
		recommendedFor: 'Balanced polish',
	},
];

/**
 * Determine the local server type based on URL / port patterns.
 */
export function inferServerType(url: string): LocalServerType {
	const lower = url.toLowerCase();
	if (lower.includes(':11434')) return 'ollama';
	if (lower.includes(':1234')) return 'lmstudio';
	if (lower.includes(':4096') || lower.includes(':4097')) return 'opencode';
	return 'custom';
}

/**
 * Extract clean, deduped model IDs from raw response JSON.
 */
export function extractLocalModelIds(payload: unknown): string[] {
	if (!payload || typeof payload !== 'object') return [];
	const data = payload as {
		models?: Array<{ name?: string; id?: string; model?: string }>;
		data?: Array<{ id?: string; name?: string }>;
	};

	const rawList: string[] = [];

	if (Array.isArray(data.models)) {
		for (const item of data.models) {
			const id = item.name || item.model || item.id;
			if (typeof id === 'string' && id.trim()) rawList.push(id.trim());
		}
	}

	if (Array.isArray(data.data)) {
		for (const item of data.data) {
			const id = item.id || item.name;
			if (typeof id === 'string' && id.trim()) rawList.push(id.trim());
		}
	}

	const excluded = ['embed', 'bge', 'nomic', 'mxbai', 'minilm', 'clip'];
	const seen = new Set<string>();
	const result: string[] = [];

	for (const id of rawList) {
		const lower = id.toLowerCase();
		if (excluded.some((term) => lower.includes(term))) continue;
		if (!seen.has(id)) {
			seen.add(id);
			result.push(id);
		}
	}

	return result;
}

/**
 * Probe a local server URL to verify if Ollama, LM Studio, or OpenCode is actively running.
 */
export async function probeLocalServer(
	endpointUrl: string,
	timeoutMs = 2500,
): Promise<LocalProbeResult> {
	const trimmed = (endpointUrl || 'http://localhost:11434').trim().replace(/\/+$/, '');
	const serverType = inferServerType(trimmed);

	// Normalize root origin (strip /v1 or /api paths if present)
	const rootOrigin = trimmed.replace(/\/v1$/, '').replace(/\/api$/, '').replace(/\/+$/, '');

	// Endpoints to attempt in priority order based on inferred type
	const probeEndpoints: string[] = [];

	if (serverType === 'ollama') {
		probeEndpoints.push(`${rootOrigin}/api/tags`);
		probeEndpoints.push(`${trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`}/models`);
	} else if (serverType === 'lmstudio') {
		probeEndpoints.push(`${trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`}/models`);
		probeEndpoints.push(`${rootOrigin}/v1/models`);
	} else if (serverType === 'opencode') {
		probeEndpoints.push(`${rootOrigin}/api/model`);
		probeEndpoints.push(`${trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`}/models`);
	} else {
		probeEndpoints.push(
			trimmed.endsWith('/models')
				? trimmed
				: trimmed.endsWith('/v1')
				? `${trimmed}/models`
				: `${trimmed}/v1/models`,
		);
		probeEndpoints.push(`${rootOrigin}/api/tags`);
	}

	const startTime = Date.now();

	for (const url of probeEndpoints) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const res = await fetch(url, {
				method: 'GET',
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			});

			clearTimeout(timer);

			if (res.ok) {
				const latencyMs = Date.now() - startTime;
				const json = (await res.json().catch(() => null)) as unknown;
				const models = extractLocalModelIds(json);

				return {
					ok: true,
					serverType,
					url,
					modelCount: models.length,
					models,
					latencyMs,
				};
			}
		} catch {
			clearTimeout(timer);
			// Try the next endpoint
		}
	}

	return {
		ok: false,
		serverType,
		url: trimmed,
		modelCount: 0,
		models: [],
		error: `Could not connect to ${serverType.toUpperCase()} at ${trimmed}. Ensure the local server is running.`,
	};
}

/**
 * Get recommended launch command for an offline local server.
 */
export function getLaunchCommand(serverType: LocalServerType, modelId?: string): string {
	const model = modelId || 'llama3.2';
	switch (serverType) {
		case 'ollama':
			return `ollama run ${model}`;
		case 'lmstudio':
			return `lms load ${model}`;
		case 'opencode':
			return 'opencode serve';
		default:
			return `ollama run ${model}`;
	}
}

