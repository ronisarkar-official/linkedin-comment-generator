import type { CommentRequest, CommentVariant, UserSettings } from "../types"
import { LlmProviderError } from "../types"
import { generateWithGemini } from "./gemini"
import { generateWithOpenRouter } from "./openrouter"

export async function generateComments(
  request: CommentRequest,
  settings: UserSettings,
): Promise<CommentVariant[]> {
  if (!settings.apiKey.trim()) {
    throw new LlmProviderError("MISSING_API_KEY", "Add your API key in the extension popup first.")
  }

  if (settings.provider === "gemini") {
    return generateWithGemini(request, settings)
  }

  if (settings.provider === "openrouter") {
    return generateWithOpenRouter(request, settings)
  }

  throw new LlmProviderError("PROVIDER_ERROR", "The selected LLM provider is not supported.")
}
