import type { LlmProvider, ModelConfig } from '../types';
import { LlmProviderError } from '../types';
import { getDefaultModels, validateModelId } from './registry';
import { attemptGet } from './shared';

function sanitizeAndDeduplicate(models: ModelConfig[]): ModelConfig[] {
  const seen = new Set<string>();
  const result: ModelConfig[] = [];
  for (const m of models) {
    try {
      const validId = validateModelId(m.id);
      if (!seen.has(validId)) {
        seen.add(validId);
        result.push({
          id: validId,
          label: m.label.trim() || validId,
        });
      }
    } catch {
      // Skip models with invalid or unsafe IDs
    }
  }
  return result;
}

export function filterGeminiModels(payload: unknown): ModelConfig[] {
  const data = payload as { models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[] }> };
  if (!Array.isArray(data?.models)) return [];

  // Excluded keywords: non-text generation, developer test/experimental, legacy PaLM/bison
  const excludedKeywords = [
    'embed',
    'imagen',
    'aqa',
    'learnlm',
    'bison',
    'gecko',
    'code',
    'exp',
    'experimental',
    'thinking',
    'preview',
    'vision',
  ];

  const friendlyNames: Record<string, string> = {
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
    'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
    'gemini-1.5-flash': 'Gemini 1.5 Flash',
    'gemini-1.5-flash-8b': 'Gemini 1.5 Flash 8B',
    'gemini-1.5-pro': 'Gemini 1.5 Pro',
  };

  const seenIds = new Set<string>();
  const models: ModelConfig[] = [];

  for (const item of data.models) {
    if (!item.name) continue;
    const methods = item.supportedGenerationMethods;
    if (methods && !methods.includes('generateContent')) {
      continue;
    }

    let cleanId = item.name.replace(/^models\//, '').trim();
    const lower = cleanId.toLowerCase();

    // Must be a gemini series model
    if (!lower.startsWith('gemini-')) continue;

    // Filter out developer / experimental / non-text models
    if (excludedKeywords.some((term) => lower.includes(term))) continue;

    // Normalize developer snapshots (e.g. gemini-1.5-flash-001 -> gemini-1.5-flash)
    cleanId = cleanId.replace(/-(?:00[1-9]|latest)$/, '');
    if (seenIds.has(cleanId)) continue;
    seenIds.add(cleanId);

    models.push({
      id: cleanId,
      label: friendlyNames[cleanId] || item.displayName || cleanId,
    });
  }

  // Priority order for LinkedIn comments: Flash models first, then Pro
  const priorityOrder = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-flash-8b',
  ];

  models.sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.id);
    const idxB = priorityOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return b.id.localeCompare(a.id);
  });

  return models;
}

export function filterOpenAIModels(payload: unknown): ModelConfig[] {
  const data = payload as { data?: Array<{ id?: string }> };
  if (!Array.isArray(data?.data)) return [];

  // Excluded: non-text, audio, realtime, embeddings, developer previews, and internal testing
  const excludedSubstrings = [
    'realtime',
    'audio',
    'transcription',
    'embedding',
    'tts',
    'whisper',
    'dall-e',
    'moderation',
    'instruct',
    'babbage',
    'davinci',
    'similarity',
    'search',
    'edit',
    'preview',
    'chatgpt-',
    'ft:',
  ];

  // Regex to remove developer snapshot dates like -2024, -0613, -0125, etc.
  const dateSnapshotPattern = /-\d{4}(?:-\d{2}-\d{2})?$/;

  const friendlyLabels: Record<string, string> = {
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'gpt-4': 'GPT-4',
    'o3-mini': 'o3-mini',
    'o1': 'o1',
    'o1-mini': 'o1-mini',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
  };

  const seen = new Set<string>();
  const models: ModelConfig[] = [];

  for (const item of data.data) {
    const id = item.id;
    if (!id) continue;
    const lower = id.toLowerCase();

    // Must be a primary text generation / reasoning model
    const isChatModel =
      lower.startsWith('gpt-4') ||
      lower.startsWith('gpt-3.5') ||
      lower.startsWith('o1') ||
      lower.startsWith('o3') ||
      lower.startsWith('gpt-5');

    if (!isChatModel) continue;
    if (excludedSubstrings.some((term) => lower.includes(term))) continue;
    if (dateSnapshotPattern.test(lower)) continue; // Filter out developer date snapshots

    if (seen.has(id)) continue;
    seen.add(id);

    let label = friendlyLabels[id];
    if (!label) {
      label = id.replace(/^gpt-/i, 'GPT-');
    }

    models.push({ id, label });
  }

  // Recommended order for LinkedIn comment generation
  const order = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini', 'gpt-4', 'gpt-3.5-turbo'];
  models.sort((a, b) => {
    const idxA = order.indexOf(a.id);
    const idxB = order.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return b.id.localeCompare(a.id);
  });

  return models;
}

export function filterAnthropicModels(payload: unknown): ModelConfig[] {
  const data = payload as { data?: Array<{ id?: string; display_name?: string; type?: string }> };
  if (!Array.isArray(data?.data)) return [];

  // Exclude legacy/developer models (Claude 1, 2, Instant)
  const excludedKeywords = ['claude-2', 'claude-instant', 'claude-1'];

  // Map to group snapshots and retain the single latest model per family
  const familyMap = new Map<string, { id: string; label: string; date: number }>();

  for (const item of data.data) {
    if (!item.id) continue;
    if (item.type && item.type !== 'model') continue;
    const lower = item.id.toLowerCase();

    if (!lower.startsWith('claude-')) continue;
    if (excludedKeywords.some((term) => lower.includes(term))) continue;

    // Group e.g. claude-3-5-sonnet-20241022 into family 'claude-3-5-sonnet'
    const match = lower.match(/^(claude-[a-z0-9.-]+?)(?:-(\d{8}))?$/);
    const family = match ? match[1] : lower;
    const date = match && match[2] ? parseInt(match[2], 10) : 99999999;

    const existing = familyMap.get(family);
    if (!existing || date > existing.date) {
      let label = item.display_name || item.id;
      label = label.replace(/\s*\(\d{4}[-/]\d{2}[-/]\d{2}\)/, '').trim();

      familyMap.set(family, {
        id: item.id,
        label,
        date,
      });
    }
  }

  const models: ModelConfig[] = Array.from(familyMap.values()).map(({ id, label }) => ({ id, label }));

  // Priority: Sonnet -> Haiku -> Opus
  models.sort((a, b) => {
    const isSonnetA = a.id.includes('sonnet');
    const isSonnetB = b.id.includes('sonnet');
    if (isSonnetA && !isSonnetB) return -1;
    if (!isSonnetA && isSonnetB) return 1;
    return b.id.localeCompare(a.id);
  });

  return models;
}

export function filterOpenRouterModels(payload: unknown): ModelConfig[] {
  const data = payload as {
    data?: Array<{
      id?: string;
      name?: string;
      architecture?: { modality?: string };
    }>;
  };
  if (!Array.isArray(data?.data)) return [];

  const models: ModelConfig[] = [
    { id: 'openrouter/auto', label: 'Auto Router' },
    { id: 'openrouter/free', label: 'Free Router' },
  ];

  // Strictly exclude developer coding models, non-text, specialized, base checkpoints
  const excludedKeywords = [
    'coder',
    'code',
    'starcoder',
    'codellama',
    'codestral',
    'dev',
    'developer',
    'embed',
    'embedding',
    'flux',
    'diffusion',
    'image',
    'midjourney',
    'audio',
    'whisper',
    'tts',
    'voice',
    'math',
    'sql',
    'medical',
    'meditron',
    'guard',
    'safety',
    'eval',
    'moderation',
    'base',
    'fp16',
    'int8',
    'int4',
    'quantized',
    'lora',
  ];

  // Approved flagship text generation families suitable for LinkedIn comment generation
  const approvedFamilies = [
    'llama-3',
    'llama-4',
    'gemini',
    'claude',
    'deepseek-chat',
    'deepseek-r1',
    'mistral-large',
    'mistral-small',
    'qwen-2.5-72b',
    'qwen3',
    'grok',
  ];

  for (const item of data.data) {
    const id = item.id;
    if (!id) continue;
    if (id === 'openrouter/auto' || id === 'openrouter/free') continue;

    const lower = id.toLowerCase();

    // Check modality if provided by OpenRouter: must be text
    const modality = item.architecture?.modality?.toLowerCase();
    if (modality && !modality.includes('text->text') && !modality.includes('text+image->text')) {
      continue;
    }

    if (excludedKeywords.some((term) => lower.includes(term))) continue;
    if (!approvedFamilies.some((fam) => lower.includes(fam))) continue;

    models.push({
      id,
      label: item.name || id,
    });
  }

  return models;
}

export function filterDeepSeekModels(payload: unknown): ModelConfig[] {
  const data = payload as { data?: Array<{ id?: string }> };
  if (!Array.isArray(data?.data)) return [];

  const friendlyLabels: Record<string, string> = {
    'deepseek-chat': 'DeepSeek Chat (V3)',
    'deepseek-reasoner': 'DeepSeek Reasoner (R1)',
  };

  return data.data
    .filter((item): item is { id: string } => {
      if (!item.id) return false;
      const lower = item.id.toLowerCase();
      return lower.includes('chat') || lower.includes('reasoner');
    })
    .map((item) => ({
      id: item.id,
      label: friendlyLabels[item.id] || item.id,
    }));
}

export function filterPerplexityModels(payload: unknown): ModelConfig[] {
  const data = payload as { data?: Array<{ id?: string }> };
  if (!Array.isArray(data?.data)) return [];

  const friendlyLabels: Record<string, string> = {
    'sonar-pro': 'Sonar Pro',
    'sonar': 'Sonar',
    'sonar-reasoning-pro': 'Sonar Reasoning Pro',
    'sonar-reasoning': 'Sonar Reasoning',
  };

  return data.data
    .filter((item): item is { id: string } => {
      if (!item.id) return false;
      const lower = item.id.toLowerCase();
      return lower.startsWith('sonar') && !lower.includes('embed');
    })
    .map((item) => ({
      id: item.id,
      label: friendlyLabels[item.id] || item.id,
    }));
}

export function filterXAIModels(payload: unknown): ModelConfig[] {
  const data = payload as { data?: Array<{ id?: string }> };
  if (!Array.isArray(data?.data)) return [];

  const excluded = ['vision', 'build', 'embed', 'image', 'audio'];
  const friendlyLabels: Record<string, string> = {
    'grok-2': 'Grok 2',
    'grok-2-mini': 'Grok 2 Mini',
    'grok-beta': 'Grok Beta',
  };

  return data.data
    .filter((item): item is { id: string } => {
      if (!item.id) return false;
      const lower = item.id.toLowerCase();
      if (!lower.startsWith('grok')) return false;
      if (excluded.some((term) => lower.includes(term))) return false;
      if (/-\d{4}/.test(lower)) return false; // Date snapshots
      return true;
    })
    .map((item) => ({
      id: item.id,
      label: friendlyLabels[item.id] || item.id,
    }));
}

export function filterOllamaModels(payload: unknown): ModelConfig[] {
  const data = payload as {
    data?: Array<{ id?: string }>;
    models?: Array<{ name?: string }>;
  };

  const rawList: string[] = [];
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item.id) rawList.push(item.id);
    }
  } else if (Array.isArray(data?.models)) {
    for (const item of data.models) {
      if (item.name) rawList.push(item.name);
    }
  }

  const excluded = ['embed', 'bge', 'nomic', 'mxbai', 'minilm', 'clip'];
  const models: ModelConfig[] = [];
  const seen = new Set<string>();

  for (const raw of rawList) {
    const lower = raw.toLowerCase();
    if (excluded.some((term) => lower.includes(term))) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);

    let cleanLabel = raw.replace(/:latest$/, '');
    cleanLabel = cleanLabel
      .split(/[:/-]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

    models.push({
      id: raw,
      label: cleanLabel || raw,
    });
  }

  return models;
}

export function filterCustomModels(payload: unknown): ModelConfig[] {
  const data = payload as {
    data?: Array<{
      id?: string;
      modelID?: string;
      name?: string;
      providerID?: string;
      type?: string;
      enabled?: boolean;
      status?: string;
    }>;
    models?: Array<{ id?: string; name?: string }>;
  };

  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
    ? data.models
    : Array.isArray(payload)
    ? (payload as Array<{ id?: string; name?: string }>)
    : [];

  const excluded = ['embed', 'whisper', 'tts', 'moderation', 'realtime', 'live'];
  const models: ModelConfig[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if ('type' in item && item.type && item.type !== 'chat') continue;
    if ('enabled' in item && item.enabled === false) continue;
    if ('status' in item && item.status === 'deprecated') continue;

    const baseId = item.id || item.name;
    if (!baseId || typeof baseId !== 'string') continue;

    // OpenCode: combine providerID with modelID/id if present
    const providerID = 'providerID' in item && typeof item.providerID === 'string' ? item.providerID : undefined;
    const fullId = providerID && !baseId.startsWith(`${providerID}/`) ? `${providerID}/${baseId}` : baseId;

    const lower = fullId.toLowerCase();
    if (excluded.some((term) => lower.includes(term))) continue;
    if (seen.has(fullId)) continue;
    seen.add(fullId);

    const displayName = item.name || baseId;
    const label = providerID ? `${displayName} (${providerID})` : displayName;

    models.push({
      id: fullId,
      label,
    });
  }

  return models;
}

export async function fetchLiveModels(
  provider: LlmProvider,
  apiKey?: string,
  customApiBase?: string,
): Promise<ModelConfig[]> {
  const trimmedKey = apiKey?.trim() ?? '';

  switch (provider) {
    case 'gemini': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your Gemini API key to fetch models.');
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmedKey)}`;
      const data = await attemptGet('Gemini', url);
      const filtered = filterGeminiModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'openai': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your OpenAI API key to fetch models.');
      }
      const url = 'https://api.openai.com/v1/models';
      const data = await attemptGet('OpenAI', url, {
        Authorization: `Bearer ${trimmedKey}`,
      });
      const filtered = filterOpenAIModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'anthropic': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your Anthropic API key to fetch models.');
      }
      const url = 'https://api.anthropic.com/v1/models';
      const data = await attemptGet('Anthropic', url, {
        'x-api-key': trimmedKey,
        'anthropic-version': '2023-06-01',
      });
      const filtered = filterAnthropicModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'openrouter': {
      const url = 'https://openrouter.ai/api/v1/models';
      const headers: Record<string, string> = {
        'X-OpenRouter-Title': 'LinkedIn Comment Generator',
      };
      if (trimmedKey) {
        headers.Authorization = `Bearer ${trimmedKey}`;
      }
      const data = await attemptGet('OpenRouter', url, headers);
      const filtered = filterOpenRouterModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'deepseek': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your DeepSeek API key to fetch models.');
      }
      const url = 'https://api.deepseek.com/models';
      const data = await attemptGet('DeepSeek', url, {
        Authorization: `Bearer ${trimmedKey}`,
      });
      const filtered = filterDeepSeekModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'perplexity': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your Perplexity API key to fetch models.');
      }
      try {
        const url = 'https://api.perplexity.ai/models';
        const data = await attemptGet('Perplexity', url, {
          Authorization: `Bearer ${trimmedKey}`,
        });
        const filtered = filterPerplexityModels(data);
        if (filtered.length > 0) {
          return sanitizeAndDeduplicate(filtered);
        }
      } catch (err) {
        if (err instanceof LlmProviderError && err.code === 'INVALID_API_KEY') {
          throw err;
        }
        // Perplexity models endpoint may not be available on all account tiers; gracefully fall back
      }
      return sanitizeAndDeduplicate(getDefaultModels(provider));
    }

    case 'xai': {
      if (!trimmedKey) {
        throw new LlmProviderError('MISSING_API_KEY', 'Add your xAI API key to fetch models.');
      }
      const url = 'https://api.x.ai/v1/models';
      const data = await attemptGet('xAI', url, {
        Authorization: `Bearer ${trimmedKey}`,
      });
      const filtered = filterXAIModels(data);
      return sanitizeAndDeduplicate(filtered.length > 0 ? filtered : getDefaultModels(provider));
    }

    case 'ollama': {
      const base = (customApiBase?.trim() || 'http://localhost:11434/v1').replace(/\/+$/, '');
      const headers: Record<string, string> = {};
      if (trimmedKey) {
        headers.Authorization = `Bearer ${trimmedKey}`;
      }

      // Try OpenAI-compatible /v1/models endpoint first
      try {
        const v1Url = base.endsWith('/v1') ? `${base}/models` : `${base}/v1/models`;
        const data = await attemptGet('Ollama', v1Url, headers, 4_000);
        const filtered = filterOllamaModels(data);
        if (filtered.length > 0) {
          return sanitizeAndDeduplicate(filtered);
        }
      } catch {
        // Fallback to native /api/tags
      }

      // Fallback to native /api/tags
      try {
        const rootOrigin = base.replace(/\/v1$/, '');
        const nativeUrl = `${rootOrigin}/api/tags`;
        const data = await attemptGet('Ollama', nativeUrl, headers, 4_000);
        const filtered = filterOllamaModels(data);
        if (filtered.length > 0) {
          return sanitizeAndDeduplicate(filtered);
        }
      } catch {
        throw new LlmProviderError(
          'NETWORK_ERROR',
          `Could not connect to Ollama at ${base}. Make sure Ollama is running (e.g. "ollama serve").`,
        );
      }

      return sanitizeAndDeduplicate(getDefaultModels(provider));
    }

    case 'custom': {
      const rawBase = (customApiBase?.trim() || 'http://localhost:4096').replace(/\/+$/, '');
      const root = rawBase.replace(/\/v1$/, '').replace(/\/api$/, '').replace(/\/+$/, '');

      // 1. Try OpenAI-compatible /models endpoint first
      const openAiHeaders: Record<string, string> = {};
      if (trimmedKey) {
        openAiHeaders.Authorization = `Bearer ${trimmedKey}`;
      }

      try {
        const v1Url = rawBase.endsWith('/models')
          ? rawBase
          : rawBase.endsWith('/v1')
          ? `${rawBase}/models`
          : `${rawBase}/v1/models`;

        const data = await attemptGet('Custom Provider', v1Url, openAiHeaders, 4_000);
        const filtered = filterCustomModels(data);
        if (filtered.length > 0) {
          return sanitizeAndDeduplicate(filtered);
        }
      } catch (err) {
        if (err instanceof LlmProviderError && err.code === 'INVALID_API_KEY') {
          // Keep trying OpenCode in case the key is meant for Basic Auth
        }
      }

      // 2. Try OpenCode serve endpoint: /api/model
      try {
        const openCodeUrl = `${root}/api/model`;
        const openCodeHeaders: Record<string, string> = {};
        if (trimmedKey) {
          const encoded =
            typeof btoa === 'function'
              ? btoa(`opencode:${trimmedKey}`)
              : Buffer.from(`opencode:${trimmedKey}`).toString('base64');
          openCodeHeaders.Authorization = `Basic ${encoded}`;
        }

        const data = await attemptGet('OpenCode', openCodeUrl, openCodeHeaders, 10_000);
        const filtered = filterCustomModels(data);
        if (filtered.length > 0) {
          return sanitizeAndDeduplicate(filtered);
        }
      } catch (err) {
        if (err instanceof LlmProviderError && err.code === 'INVALID_API_KEY') {
          throw new LlmProviderError(
            'INVALID_API_KEY',
            'OpenCode rejected the server password. Check the password printed by "opencode serve" and enter it as the API Key.',
          );
        }
      }

      throw new LlmProviderError(
        'NETWORK_ERROR',
        `Could not connect to custom server at ${rawBase}. Ensure your server (OpenCode, LM Studio, Ollama, etc.) is running.`,
      );
    }

    default:
      return getDefaultModels(provider);
  }
}
