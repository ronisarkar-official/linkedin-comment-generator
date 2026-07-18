import { logger } from '../logger';
import { LlmProviderError } from '../types';

const REQUEST_TIMEOUT_MS = 30_000;

export async function attemptFetch(
  label: string,
  endpoint: string,
  headers: Record<string, string>,
  body: string,
  attempt: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  logger.info(`${label} request started.`, { attempt });

  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LlmProviderError('NETWORK_ERROR', `${label} request timed out. Try again.`);
    }
    throw new LlmProviderError('NETWORK_ERROR', `Could not reach ${label}. Check your connection and try again.`);
  } finally {
    clearTimeout(timeout);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new LlmProviderError('INVALID_RESPONSE', `${label} returned a response that could not be read.`);
  }

  if (!response.ok) {
    const errPayload = payload as Record<string, unknown> | null;
    const message = errPayload?.error ? (errPayload.error as Record<string, unknown>).message as string : `${label} rejected the request.`;
    logger.warn(`${label} API error.`, { status: response.status, message });
    if (response.status === 401 || response.status === 403) {
      throw new LlmProviderError('INVALID_API_KEY', message);
    }
    if (response.status === 429) {
      const retryAfter = (() => {
        const h = response.headers.get('retry-after');
        const s = Number(h);
        return h && Number.isFinite(s) ? s : undefined;
      })();
      throw new LlmProviderError('RATE_LIMITED', message, retryAfter);
    }
    throw new LlmProviderError('PROVIDER_ERROR', message);
  }

  return payload;
}
