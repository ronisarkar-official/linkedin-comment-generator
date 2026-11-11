import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	LOCAL_MODEL_PRESETS,
	extractLocalModelIds,
	getLaunchCommand,
	inferServerType,
	probeLocalServer,
} from '../src/lib/llm/local-probe';

describe('Local AI Health & Model Probe', () => {
	describe('inferServerType', () => {
		it('detects Ollama from port 11434', () => {
			expect(inferServerType('http://localhost:11434')).toBe('ollama');
			expect(inferServerType('http://127.0.0.1:11434/v1')).toBe('ollama');
		});

		it('detects LM Studio from port 1234', () => {
			expect(inferServerType('http://localhost:1234')).toBe('lmstudio');
			expect(inferServerType('http://127.0.0.1:1234/v1')).toBe('lmstudio');
		});

		it('detects OpenCode from ports 4096 and 4097', () => {
			expect(inferServerType('http://localhost:4096')).toBe('opencode');
			expect(inferServerType('http://127.0.0.1:4097/v1')).toBe('opencode');
		});

		it('falls back to custom for other endpoints', () => {
			expect(inferServerType('http://localhost:8080/v1')).toBe('custom');
			expect(inferServerType('https://my-proxy.internal/v1')).toBe('custom');
		});
	});

	describe('extractLocalModelIds', () => {
		it('extracts and deduplicates Ollama /api/tags models', () => {
			const payload = {
				models: [
					{ name: 'llama3.2:latest', model: 'llama3.2:latest' },
					{ name: 'deepseek-r1:8b', model: 'deepseek-r1:8b' },
					{ name: 'nomic-embed-text:latest' }, // Should be excluded
					{ name: 'llama3.2:latest' }, // Duplicate
				],
			};

			const models = extractLocalModelIds(payload);
			expect(models).toEqual(['llama3.2:latest', 'deepseek-r1:8b']);
		});

		it('extracts OpenAI-compatible /v1/models array', () => {
			const payload = {
				data: [
					{ id: 'mistral:7b' },
					{ id: 'qwen2.5:7b' },
					{ id: 'bge-m3' }, // Excluded embedding model
				],
			};

			const models = extractLocalModelIds(payload);
			expect(models).toEqual(['mistral:7b', 'qwen2.5:7b']);
		});

		it('returns empty array on invalid payload', () => {
			expect(extractLocalModelIds(null)).toEqual([]);
			expect(extractLocalModelIds('not json')).toEqual([]);
			expect(extractLocalModelIds({})).toEqual([]);
		});
	});

	describe('getLaunchCommand', () => {
		it('returns correct commands for each server type', () => {
			expect(getLaunchCommand('ollama', 'llama3.2:3b')).toBe('ollama run llama3.2:3b');
			expect(getLaunchCommand('ollama')).toBe('ollama run llama3.2');
			expect(getLaunchCommand('lmstudio', 'qwen2.5:7b')).toBe('lms load qwen2.5:7b');
			expect(getLaunchCommand('opencode')).toBe('opencode serve');
			expect(getLaunchCommand('custom', 'mistral:7b')).toBe('ollama run mistral:7b');
		});
	});

	describe('LOCAL_MODEL_PRESETS', () => {
		it('provides the 4 lightweight recommended local models', () => {
			expect(LOCAL_MODEL_PRESETS).toHaveLength(4);
			const tags = LOCAL_MODEL_PRESETS.map((p) => p.tag);
			expect(tags).toContain('llama3.2:3b');
			expect(tags).toContain('deepseek-r1:8b');
			expect(tags).toContain('qwen2.5:7b');
			expect(tags).toContain('mistral:7b');

			for (const preset of LOCAL_MODEL_PRESETS) {
				expect(preset.name).toBeTruthy();
				expect(preset.size).toMatch(/\d+(\.\d+)?\s*GB/);
				expect(preset.ollamaCommand).toContain('ollama run');
			}
		});
	});

	describe('probeLocalServer', () => {
		const originalFetch = global.fetch;

		afterEach(() => {
			global.fetch = originalFetch;
			vi.restoreAllMocks();
		});

		it('returns ok: true when Ollama responds', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					models: [
						{ name: 'llama3.2:latest' },
						{ name: 'deepseek-r1:8b' },
					],
				}),
			} as unknown as Response);

			const result = await probeLocalServer('http://localhost:11434', 1000);
			expect(result.ok).toBe(true);
			expect(result.serverType).toBe('ollama');
			expect(result.modelCount).toBe(2);
			expect(result.models).toContain('llama3.2:latest');
			expect(result.models).toContain('deepseek-r1:8b');
			expect(result.latencyMs).toBeTypeOf('number');
		});

		it('returns ok: true when LM Studio responds', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({
					data: [{ id: 'qwen2.5-7b-instruct' }],
				}),
			} as unknown as Response);

			const result = await probeLocalServer('http://localhost:1234/v1', 1000);
			expect(result.ok).toBe(true);
			expect(result.serverType).toBe('lmstudio');
			expect(result.modelCount).toBe(1);
			expect(result.models).toEqual(['qwen2.5-7b-instruct']);
		});

		it('returns ok: false when the local server is offline or times out', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

			const result = await probeLocalServer('http://localhost:11434', 500);
			expect(result.ok).toBe(false);
			expect(result.serverType).toBe('ollama');
			expect(result.modelCount).toBe(0);
			expect(result.error).toContain('Could not connect to OLLAMA');
		});
	});
});

