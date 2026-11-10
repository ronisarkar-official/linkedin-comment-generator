import { buildCommentPrompt } from '../prompt-templates';
import type { CommentRequest, CommentVariant, HistoryEntry, UserSettings } from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';
import { parseContent } from './parse-response';
import { validateModelId } from './registry';
import { attemptFetch } from './shared';

export async function generateWithOpenCode(
  request: CommentRequest,
  settings: UserSettings,
  history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
  const providerLabel = 'OpenCode';
  const model = validateModelId(settings.model || 'default');

  const rawApiBase = settings.customApiBase?.trim() || 'http://localhost:4096';
  const root = rawApiBase.replace(/\/v1$/, '').replace(/\/api$/, '').replace(/\/+$/, '');
  const endpoint = `${root}/api/experimental/generate/text`;
  const apiKey = settings.apiKeys.custom ?? '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey.trim()) {
    const encoded =
      typeof btoa === 'function'
        ? btoa(`opencode:${apiKey.trim()}`)
        : Buffer.from(`opencode:${apiKey.trim()}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  // Model reference for OpenCode: providerID/id
  const slashIdx = model.indexOf('/');
  const modelRef =
    slashIdx !== -1
      ? { providerID: model.slice(0, slashIdx), id: model.slice(slashIdx + 1) }
      : model === 'default'
      ? null
      : { providerID: 'opencode', id: model };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildCommentPrompt(request, settings, history, attempt);
    const fullPrompt = `${prompt.system}\n\n${prompt.user}`;

    const body: Record<string, unknown> = {
      prompt: fullPrompt,
    };
    if (modelRef) {
      body.model = modelRef;
    }

    try {
      const payload = await attemptFetch(providerLabel, endpoint, headers, JSON.stringify(body), attempt);
      const resp = payload as { data?: { text?: string } };
      const rawText = resp?.data?.text;

      if (!rawText) {
        throw new LlmProviderError('INVALID_RESPONSE', `${providerLabel} returned no comment variants.`);
      }

      const variants = parseContent(rawText, providerLabel);
      if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
        continue;
      }

      return variants;
    } catch (err) {
      if (err instanceof LlmProviderError && err.code === 'INVALID_API_KEY') {
        throw new LlmProviderError(
          'INVALID_API_KEY',
          'OpenCode authentication required. Copy the server password from your terminal and save it as the API Key in the popup.',
        );
      }
      throw err;
    }
  }

  throw new LlmProviderError('INVALID_RESPONSE', `${providerLabel} returned repetitive comment variants.`);
}

