import { getSettings } from "../lib/storage"
import type {
  CommentVariant,
  GenerateCommentsFailure,
  GenerateCommentsResponse,
} from "../lib/types"
import {
  findActionBar,
  findAuthorName,
  findPostText,
  POST_CONTAINER_SELECTORS,
} from "./dom-selectors"

const INJECTED_ATTRIBUTE = "data-lcg-injected"
const REQUESTS_PER_MINUTE = 5
const POST_DEBOUNCE_MS = 8_000
const recentRequests: number[] = []
const lastRequestByPost = new WeakMap<HTMLElement, number>()
const postContainerSelector = POST_CONTAINER_SELECTORS.join(",")

export interface InjectionCallbacks {
  onVariants: (post: HTMLElement, variants: CommentVariant[], anchor: HTMLElement) => void
  onError: (post: HTMLElement, message: string, anchor: HTMLElement) => void
}

function setLoading(button: HTMLButtonElement, loading: boolean): void {
  button.disabled = loading
  button.setAttribute("aria-busy", String(loading))
  button.replaceChildren()

  if (loading) {
    const spinner = document.createElement("span")
    spinner.className = "lcg-spinner"
    spinner.setAttribute("aria-hidden", "true")
    const label = document.createElement("span")
    label.textContent = "Generating…"
    button.append(spinner, label)
    return
  }

  button.textContent = "Generate Comment"
}

function checkClientRateLimit(post: HTMLElement): string | null {
  const now = Date.now()
  const lastPostRequest = lastRequestByPost.get(post) ?? 0
  if (now - lastPostRequest < POST_DEBOUNCE_MS) {
    return "Please wait a few seconds before regenerating comments for this post."
  }

  while (recentRequests.length > 0 && now - recentRequests[0] >= 60_000) {
    recentRequests.shift()
  }

  if (recentRequests.length >= REQUESTS_PER_MINUTE) {
    const retrySeconds = Math.max(1, Math.ceil((60_000 - (now - recentRequests[0])) / 1000))
    return `Local rate limit reached. Try again in ${retrySeconds} seconds.`
  }

  lastRequestByPost.set(post, now)
  recentRequests.push(now)
  return null
}

function getFailureMessage(failure: GenerateCommentsFailure): string {
  switch (failure.error.code) {
    case "MISSING_API_KEY":
      return "Add an API key for the selected provider in the extension popup first."
    case "INVALID_API_KEY":
      return "The selected AI provider rejected the API key. Update it in the extension popup."
    case "RATE_LIMITED":
      return failure.error.retryAfter
        ? `AI provider rate limit reached. Try again in ${failure.error.retryAfter} seconds.`
        : "AI provider rate limit reached. Please wait and try again."
    case "NETWORK_ERROR":
      return "Could not reach the selected AI provider. Check your connection and try again."
    default:
      return failure.error.message
  }
}

function findCanonicalPost(post: HTMLElement): HTMLElement {
  let canonical = post
  let candidate: HTMLElement | null = post

  while (candidate && candidate.tagName !== "MAIN" && candidate !== document.body) {
    try {
      if (candidate.matches(postContainerSelector)) canonical = candidate
    } catch {
      return canonical
    }
    candidate = candidate.parentElement
  }

  return canonical
}

function sendGenerateRequest(
  postText: string,
  authorName: string | undefined,
  tone: "professional" | "witty" | "supportive",
  length: string,
): Promise<GenerateCommentsResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: "GENERATE_COMMENTS",
        payload: { postText, authorName, tone, length },
      },
      (response: GenerateCommentsResponse | undefined) => {
        const runtimeError = chrome.runtime.lastError
        if (runtimeError) {
          reject(new Error(runtimeError.message))
          return
        }
        if (!response) {
          reject(new Error("The extension background service did not respond."))
          return
        }
        resolve(response)
      },
    )
  })
}

export function injectGenerateButton(post: HTMLElement, callbacks: InjectionCallbacks): void {
  post = findCanonicalPost(post)

  const existingButtons = [...post.querySelectorAll<HTMLButtonElement>(".lcg-generate-button")]
  if (existingButtons.length > 0) {
    existingButtons.slice(1).forEach((button) => button.remove())
    post.setAttribute(INJECTED_ATTRIBUTE, "true")
    return
  }

  if (post.hasAttribute(INJECTED_ATTRIBUTE)) {
    post.removeAttribute(INJECTED_ATTRIBUTE)
  }

  let actionBar = findActionBar(post)
  if (!actionBar) {
    actionBar = document.createElement("div")
    actionBar.className = "lcg-fallback-action-bar"
    actionBar.setAttribute("data-lcg-fallback-action-bar", "true")
    post.append(actionBar)
  }

  const button = document.createElement("button")
  button.type = "button"
  button.className = "lcg-generate-button"
  button.textContent = "Generate Comment"
  button.setAttribute("aria-label", "Generate LinkedIn comment variants")

  button.addEventListener("click", async () => {
    const postText = findPostText(post)
    if (!postText) {
      callbacks.onError(post, "Could not read this LinkedIn post.", button)
      return
    }

    setLoading(button, true)
    try {
      const settings = await getSettings()
      if (!settings.apiKey.trim()) {
        callbacks.onError(
          post,
          `Add your ${settings.provider === "openrouter" ? "OpenRouter" : "Gemini"} API key in the extension popup first.`,
          button,
        )
        return
      }

      const rateLimitError = checkClientRateLimit(post)
      if (rateLimitError) {
        callbacks.onError(post, rateLimitError, button)
        return
      }

      const response = await sendGenerateRequest(
        postText,
        findAuthorName(post),
        settings.defaultTone,
        settings.commentLength,
      )

      if (!response.ok) {
        callbacks.onError(post, getFailureMessage(response), button)
        return
      }

      callbacks.onVariants(post, response.variants, button)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate comments."
      callbacks.onError(post, message, button)
    } finally {
      setLoading(button, false)
    }
  })

  actionBar.append(button)
  post.setAttribute(INJECTED_ATTRIBUTE, "true")
}
