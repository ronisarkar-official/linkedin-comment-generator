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

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      // Body is not valid JSON
    }
  }

  if (!response.ok) {
    const errPayload = payload as Record<string, unknown> | null;
    const fallbackMsg = rawText.trim()
      ? `${label} returned HTTP ${response.status}: ${rawText.slice(0, 150)}`
      : `${label} returned HTTP ${response.status}${response.statusText ? ' (' + response.statusText + ')' : ''}.`;

    const message =
      typeof errPayload?.message === 'string'
        ? errPayload.message
        : errPayload?.error
        ? typeof errPayload.error === 'string'
          ? errPayload.error
          : ((errPayload.error as Record<string, unknown>).message as string) || fallbackMsg
        : fallbackMsg;

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

  if (payload === null) {
    throw new LlmProviderError('INVALID_RESPONSE', `${label} returned a response that could not be read.`);
  }

  return payload;
}

export async function attemptGet(
  label: string,
  endpoint: string,
  headers: Record<string, string> = {},
  timeoutMs = 15_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, { method: 'GET', headers, signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LlmProviderError('NETWORK_ERROR', `${label} models request timed out.`);
    }
    throw new LlmProviderError('NETWORK_ERROR', `Could not reach ${label}. Check your connection and try again.`);
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      // Body is not valid JSON
    }
  }

  if (!response.ok) {
    const errPayload = payload as Record<string, unknown> | null;
    const fallbackMsg = rawText.trim()
      ? `${label} returned HTTP ${response.status}: ${rawText.slice(0, 150)}`
      : `${label} returned HTTP ${response.status}${response.statusText ? ' (' + response.statusText + ')' : ''}.`;

    const message =
      typeof errPayload?.message === 'string'
        ? errPayload.message
        : errPayload?.error
        ? typeof errPayload.error === 'string'
          ? errPayload.error
          : ((errPayload.error as Record<string, unknown>).message as string) || fallbackMsg
        : fallbackMsg;

    logger.warn(`${label} API error while fetching models.`, { status: response.status, message });
    if (response.status === 401 || response.status === 403) {
      throw new LlmProviderError('INVALID_API_KEY', message);
    }
    if (response.status === 429) {
      throw new LlmProviderError('RATE_LIMITED', message);
    }
    throw new LlmProviderError('PROVIDER_ERROR', message);
  }

  if (payload === null) {
    throw new LlmProviderError('INVALID_RESPONSE', `${label} returned a response that could not be parsed as JSON.`);
  }

  return payload;
}
