import { buildCommentPrompt } from '../prompt-templates';
import type { CommentRequest, CommentVariant, HistoryEntry, UserSettings } from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';
import { parseContent } from './parse-response';
import { getProvider, validateModelId } from './registry';
import { attemptFetch } from './shared';

export async function generateWithOpenAICompat(
  request: CommentRequest,
  settings: UserSettings,
  history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
  const providerConfig = getProvider(settings.provider);
  const providerLabel = providerConfig.label;
  const model = validateModelId(settings.model || providerConfig.models[0].id);

  const rawApiBase =
    (settings.provider === 'custom' || settings.provider === 'ollama') && settings.customApiBase?.trim()
      ? settings.customApiBase.trim()
      : providerConfig.apiBase;
  const apiBase = rawApiBase.replace(/\/+$/, '');
  const chatEndpoint = apiBase.endsWith('/chat/completions') ? apiBase : `${apiBase}/chat/completions`;
  const apiKey = settings.apiKeys[settings.provider] ?? '';

  const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(apiBase);
  if (!apiBase.startsWith('https://') && !isLocalhost) {
    throw new LlmProviderError('PROVIDER_ERROR', `${providerLabel} API endpoint must use HTTPS.`);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  if (settings.provider === 'openrouter') {
    headers['X-OpenRouter-Title'] = 'LinkedIn Comment Generator';
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildCommentPrompt(request, settings, history, attempt);

    let responseFormat: Record<string, unknown> | undefined;
    if (providerConfig.responseFormat === 'json_schema') {
      responseFormat = {
        type: 'json_schema',
        json_schema: {
          name: 'comment_variants', strict: true,
          schema: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'object', additionalProperties: false, required: ['tone', 'text', 'congratulation'], properties: { tone: { type: 'string' }, text: { type: 'string' }, congratulation: { type: 'boolean' } } } },
        },
      };
    } else if (providerConfig.responseFormat === 'json_object') {
      responseFormat = { type: 'json_object' };
    }

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: attempt === 0 ? 0.72 : 0.82,
      top_p: 0.85,
    };
    if (isLocalhost || settings.provider === 'ollama') {
      body.max_tokens = 2_048;
    } else {
      body.max_completion_tokens = 2_048;
    }
    if (responseFormat) body.response_format = responseFormat;

    const payload = await attemptFetch(providerLabel, chatEndpoint, headers, JSON.stringify(body), attempt);
    const chatPayload = payload as Record<string, unknown>;
    let rawText: string | undefined;

    const choice = (chatPayload.choices as Array<Record<string, unknown>> | undefined)?.[0];
    if (choice?.error) {
      throw new LlmProviderError('PROVIDER_ERROR', (choice.error as Record<string, unknown>).message as string);
    }
    const message = choice?.message as { content?: string | Array<{ type?: string; text?: string }> } | undefined;
    const content = message?.content;
    if (typeof content === 'string') rawText = content;
    else if (Array.isArray(content)) rawText = content.filter((p) => p.type === undefined || p.type === 'text').map((p) => p.text ?? '').join('\n').trim();

    if (!rawText) {
      throw new LlmProviderError('INVALID_RESPONSE', `${providerLabel} returned no comment variants.`);
    }

    const variants = parseContent(rawText, providerLabel);
    if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
      continue;
    }

    return variants;
  }

  throw new LlmProviderError('INVALID_RESPONSE', `${providerLabel} returned repetitive comment variants.`);
}
