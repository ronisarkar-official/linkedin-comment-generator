import { buildCommentPrompt } from '../prompt-templates';
import type { CommentRequest, CommentVariant, HistoryEntry, UserSettings } from '../types';
import { LlmProviderError } from '../types';
import { needsFreshnessRetry } from './freshness';
import { validateVariants } from './parse-response';
import { validateModelId } from './registry';
import { attemptFetch } from './shared';

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

export async function generateWithGemini(
  request: CommentRequest,
  settings: UserSettings,
  history: HistoryEntry[] = [],
): Promise<CommentVariant[]> {
  const model = validateModelId(settings.model || 'gemini-2.5-flash');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildCommentPrompt(request, settings, history, attempt);

    const payload = await attemptFetch(
      'Gemini', endpoint,
      { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKeys.gemini ?? '' },
      JSON.stringify({
        systemInstruction: { parts: [{ text: prompt.system }] },
        contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
        generationConfig: {
          temperature: attempt === 0 ? 0.92 : 0.97,
          topP: 0.9,
          maxOutputTokens: 1_024,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY', minItems: 3, maxItems: 3,
            items: { type: 'OBJECT', required: ['tone', 'text', 'congratulation'], properties: { tone: { type: 'STRING' }, text: { type: 'STRING' }, congratulation: { type: 'BOOLEAN' } } },
          },
        },
      }),
      attempt,
    );

    const geminiPayload = payload as GeminiResponse;
    const rawText = geminiPayload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();

    if (!rawText) {
      throw new LlmProviderError('INVALID_RESPONSE', 'Gemini returned no comment variants.');
    }

    let variants: CommentVariant[];
    try {
      variants = validateVariants(JSON.parse(rawText), 'Gemini');
    } catch (error) {
      if (error instanceof LlmProviderError) throw error;
      throw new LlmProviderError('INVALID_RESPONSE', 'Gemini returned malformed JSON.');
    }

    if (attempt === 0 && needsFreshnessRetry(request, variants, history)) {
      continue;
    }

    return variants;
  }

  throw new LlmProviderError('INVALID_RESPONSE', 'Gemini returned repetitive comment variants.');
}
