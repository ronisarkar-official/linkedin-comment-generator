import { buildCommentPrompt } from '../prompt-templates';
import type { CommentRequest, CommentVariant, HistoryEntry, UserSettings } from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';
import { parseContent } from './parse-response';
import { getProvider, validateModelId } from './registry';
import { attemptFetch } from './shared';

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

export async function generateWithAnthropic(
  request: CommentRequest,
  settings: UserSettings,
  history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
  const model = validateModelId(settings.model || getProvider('anthropic').models[0].id);
  const endpoint = 'https://api.anthropic.com/v1/messages';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildCommentPrompt(request, settings, history, attempt);

    const payload = await attemptFetch(
      'Anthropic', endpoint,
      {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKeys.anthropic ?? '',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      JSON.stringify({
        model,
        max_tokens: 2_048,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        temperature: attempt === 0 ? 0.72 : 0.82,
        top_p: 0.85,
      }),
      attempt,
    );

    const rawText = (payload as AnthropicResponse).content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
      .trim();

    if (!rawText) {
      throw new LlmProviderError('INVALID_RESPONSE', 'Anthropic returned no comment variants.');
    }

    const variants = parseContent(rawText, 'Anthropic');
    if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
      continue;
    }

    return variants;
  }

  throw new LlmProviderError('INVALID_RESPONSE', 'Anthropic returned repetitive comment variants.');
}
