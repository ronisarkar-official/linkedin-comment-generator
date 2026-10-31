import { logger } from '../lib/logger';

export const FEED_CONTAINER_SELECTORS = [
  '[data-testid="mainFeed"]',
  '[data-view-name="main-feed"]',
  "ol.feed-container",
  "main .scaffold-finite-scroll",
  "main [data-finite-scroll-hotkey-context]",
  "main",
]

export const POST_CONTAINER_SELECTORS = [
  'article[data-id="main-feed-card"]',
  '[data-testid="mainFeed"] article',
  '[data-testid="mainFeed"] li.feed-item',
  '[data-view-name*="feed-full-update"]',
  'div[data-id^="urn:li:activity:"]',
  '[data-id*="urn:li:activity"]',
  '[data-urn*="urn:li:activity:"]',
  '[data-urn*="activity"]',
  '[data-view-tracking-scope*="transporterKeys"]',
  "li.feed-item",
  '[class*="occludable-update"]',
  'div[class*="feed-shared-update"]',
  "div.feed-shared-update-v2",
  'div[data-urn^="urn:li:activity"]',
  'article[data-urn^="urn:li:activity"]',
  "main article",
]

const COMBINED_POST_SELECTOR = POST_CONTAINER_SELECTORS.join(",")
const ACTIVITY_CONTAINER_SELECTOR = [
  '[data-id*="urn:li:activity"]',
  '[data-urn*="urn:li:activity"]',
  '[data-id*="urn:li:ugcPost"]',
  '[data-urn*="urn:li:ugcPost"]',
].join(",")
const COMMENT_CONTENT_SELECTOR = [
  ".comments-comment-item",
  ".comments-comment-box",
  ".comments-comment-list",
  '[data-view-name*="comment-item"]',
  '[data-id^="urn:li:comment:"]',
  '[data-urn^="urn:li:comment:"]',
].join(",")

export const POST_TEXT_SELECTORS = [
  '[data-view-name="feed-commentary"]',
  '[data-view-name*="feed-commentary"]',
  '[data-testid*="commentary"]',
  '[data-ad-preview="message"]',
  ".update-components-text",
  '[class*="update-components-text"]',
  '[class*="feed-shared-text"]',
  ".feed-shared-update-v2__description",
  ".feed-shared-inline-show-more-text",
  ".break-words",
  '[data-test-id="main-feed-activity-card"] [dir="ltr"]',
]

export const POST_AUTHOR_SELECTORS = [
  '[data-view-name*="actor-name"]',
  '[data-testid*="actor-name"]',
  ".update-components-actor__name",
  ".feed-shared-actor__name",
  'a[href*="/in/"] strong',
  'span[aria-hidden="true"]',
]

export const ACTION_BAR_SELECTORS = [
  '[data-view-name*="social-action"]',
  '[data-view-name*="feed-action-bar"]',
  '[data-testid*="social-actions"]',
  '[role="group"][aria-label*="action" i]',
  ".feed-shared-social-action-bar",
  ".social-details-social-actions",
  '[class*="social-action-bar"]',
  '[data-test-id="feed-shared-social-action-bar"]',
]

export const COMMENT_INPUT_SELECTORS = [
  'textarea[placeholder*="comment" i]',
  'textarea[aria-label*="comment" i]',
  '[data-view-name*="comment-box"] [contenteditable="true"]',
  '[data-placeholder*="comment" i][contenteditable="true"]',
  '[contenteditable="true"][aria-label*="comment" i]',
  '[contenteditable="true"][aria-label*="editor" i]',
  '.comments-comment-box__content-editor [contenteditable="true"]',
  '.comments-comment-box-comment__text-editor [contenteditable="true"]',
  '.ql-editor[contenteditable="true"]',
  'div[contenteditable="true"][role="textbox"]',
]

export const COMMENT_TRIGGER_SELECTORS = [
  'button[data-view-name*="comment"]',
  'button[aria-label*="comment" i]',
  'button[data-control-name="comment"]',
]

export const COMMENT_SUBMIT_SELECTORS = [
  'button[data-view-name*="comment-submit"]',
  'button[aria-label*="post comment" i]',
  ".comments-comment-box__submit-button--cr",
  ".comments-comment-box__submit-button",
  'button[type="submit"]',
]

function queryFirst<T extends Element>(root: ParentNode, selectors: string[]): T | null {
  for (const selector of selectors) {
    try {
      const element = root.querySelector<T>(selector)
      if (element) return element
    } catch (error) {
      logger.debug("Skipped an invalid selector.", { selector, error: String(error) })
    }
  }
  return null
}

export function findFeedContainer(): HTMLElement | null {
  return queryFirst<HTMLElement>(document, FEED_CONTAINER_SELECTORS)
}

export function findPosts(root: ParentNode = document): HTMLElement[] {
  const posts = new Set<HTMLElement>()

  for (const selector of POST_CONTAINER_SELECTORS) {
    try {
      root.querySelectorAll<HTMLElement>(selector).forEach((post) => posts.add(post))
    } catch (error) {
      logger.debug("Could not query posts.", { selector, error: String(error) })
    }
  }

  const combinedPostSelector = POST_CONTAINER_SELECTORS.join(",")
  for (const selector of COMMENT_TRIGGER_SELECTORS) {
    try {
      root.querySelectorAll<HTMLElement>(selector).forEach((trigger) => {
        const post = trigger.closest<HTMLElement>(combinedPostSelector)
        if (post) posts.add(post)
      })
    } catch (error) {
      logger.debug("Could not locate posts by controls.", { selector, error: String(error) })
    }
  }

  try {
    root.querySelectorAll<HTMLElement>('button, [role="button"]').forEach((control) => {
      const signal = [
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.getAttribute("data-view-name"),
        control.getAttribute("data-control-name"),
        control.textContent,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      if (!/(comment|like|repost|share|send)/.test(signal)) return

      let candidate = control.parentElement
      let depth = 0
      while (candidate && candidate !== document.body && depth < 12) {
        const rect = candidate.getBoundingClientRect()
        const textLength = candidate.innerText.trim().length
        const buttonCount = candidate.querySelectorAll('button, [role="button"]').length
        if (
          rect.height >= 180 &&
          textLength >= 40 &&
          textLength <= 12_000 &&
          buttonCount >= 3 &&
          buttonCount <= 30
        ) {
          posts.add(candidate)
          break
        }
        candidate = candidate.parentElement
        depth += 1
      }
    })
  } catch (error) {
    logger.debug("Could not locate posts semantically.", { error: String(error) })
  }

  const matched = [...posts].filter(
    (post) => Boolean(findPostText(post)) && isSinglePostContainer(post),
  )
  return matched.filter(
    (post) => !matched.some((other) => other !== post && other.contains(post)),
  )
}

/**
 * A valid post container must not span more than one top-level activity.
 * Nested activity containers (e.g. a repost's original update) are ignored.
 */
export function isSinglePostContainer(element: HTMLElement): boolean {
  const identities = new Set<string>()
  const nodes = [
    element,
    ...element.querySelectorAll<HTMLElement>(ACTIVITY_CONTAINER_SELECTOR),
  ]

  for (const node of nodes) {
    if (node.closest(COMMENT_CONTENT_SELECTOR)) continue

    const identity = node.getAttribute("data-id") ?? node.getAttribute("data-urn")
    if (!identity) continue

    const nesting = node.parentElement?.closest<HTMLElement>(ACTIVITY_CONTAINER_SELECTOR)
    if (nesting && element.contains(nesting)) continue

    identities.add(identity)
    if (identities.size > 1) return false
  }

  return true
}

/**
 * Nearest ancestor-or-self that represents one feed post. Never widens to a
 * feed-level wrapper that can contain several posts.
 */
export function findPostContainer(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element

  while (node && node !== document.body && node.tagName !== "MAIN") {
    try {
      if (node.matches(COMBINED_POST_SELECTOR) && isSinglePostContainer(node)) {
        return node
      }
    } catch {
      return null
    }
    node = node.parentElement
  }

  return null
}

export function findPostTextElement(post: HTMLElement): HTMLElement | null {
  const matched = queryFirst<HTMLElement>(post, POST_TEXT_SELECTORS)
  if (matched) return matched

  const candidates = [...post.querySelectorAll<HTMLElement>('[dir="ltr"], p')].filter((element) => {
    const text = element.innerText.trim()
    return (
      text.length >= 20 &&
      text.length <= 6_000 &&
      !element.closest("button, nav") &&
      element.children.length <= 12
    )
  })

  return candidates.sort((left, right) => right.innerText.length - left.innerText.length)[0] ?? null
}

export function findPostText(post: HTMLElement): string {
  return findPostTextElement(post)?.innerText.trim() ?? ""
}

export function findAuthorName(post: HTMLElement): string | undefined {
  const value = queryFirst<HTMLElement>(post, POST_AUTHOR_SELECTORS)?.innerText.trim()
  return value || undefined
}

export function findActionBar(post: HTMLElement): HTMLElement | null {
  const matched = queryFirst<HTMLElement>(post, ACTION_BAR_SELECTORS)
  if (matched) return matched

  const actionTrigger =
    findCommentTrigger(post) ??
    queryFirst<HTMLButtonElement>(post, [
      'button[aria-label*="like" i]',
      'button[aria-label*="repost" i]',
      'button[aria-label*="share" i]',
    ])

  if (!actionTrigger) return null

  const labelledGroup = actionTrigger.closest<HTMLElement>('[role="group"]')
  if (labelledGroup && post.contains(labelledGroup)) return labelledGroup

  let ancestor = actionTrigger.parentElement
  while (ancestor && ancestor !== post) {
    const buttonCount = ancestor.querySelectorAll("button").length
    if (buttonCount >= 3 && buttonCount <= 10) return ancestor
    ancestor = ancestor.parentElement
  }

  const buttons = [...post.querySelectorAll<HTMLButtonElement>("button")].reverse()
  for (const button of buttons) {
    let candidate = button.parentElement
    while (candidate && candidate !== post) {
      const buttonCount = candidate.querySelectorAll("button").length
      if (buttonCount >= 3 && buttonCount <= 12) return candidate
      candidate = candidate.parentElement
    }
  }

  return actionTrigger.parentElement
}

function collectCommentInputs(root: ParentNode): HTMLElement[] {
  const inputs = new Set<HTMLElement>()

  for (const selector of COMMENT_INPUT_SELECTORS) {
    try {
      root.querySelectorAll<HTMLElement>(selector).forEach((input) => inputs.add(input))
    } catch (error) {
      logger.debug("Could not query comment inputs.", { selector, error: String(error) })
    }
  }

  return [...inputs]
}

function isVisibleCommentInput(input: HTMLElement): boolean {
  const rect = input.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0 && input.getAttribute("aria-hidden") !== "true"
}

export function findCommentInput(post: HTMLElement): HTMLElement | null {
  return collectCommentInputs(post).find(isVisibleCommentInput) ?? null
}

export function findVisibleCommentInputs(): HTMLElement[] {
  return collectCommentInputs(document).filter(isVisibleCommentInput)
}

function readPostActivityIdentity(element: HTMLElement): string | null {
  const value = element.getAttribute("data-id") ?? element.getAttribute("data-urn")
  return value && /^urn:li:(activity|ugcPost):/.test(value) ? value : null
}

/**
 * Stable activity identity for the post that owns this element. Comment URNs
 * contain an activity URN as a substring, so only real post activity IDs count.
 */
export function findPostIdentity(element: HTMLElement): string | null {
  let node: HTMLElement | null = element
  while (node && node !== document.body) {
    const identity = readPostActivityIdentity(node)
    if (identity) return identity
    node = node.parentElement
  }

  const descendant = element.querySelector<HTMLElement>(ACTIVITY_CONTAINER_SELECTOR)
  return descendant ? readPostActivityIdentity(descendant) : null
}

function isComposerAfterTrigger(trigger: HTMLElement, input: HTMLElement): boolean {
  return Boolean(
    trigger.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
}

function matchesPostIdentity(input: HTMLElement, identity: string | null): boolean {
  if (!identity) return true
  const inputIdentity = findPostIdentity(input)
  return inputIdentity === null || inputIdentity === identity
}

/**
 * Finds the composer for this post even when LinkedIn renders the comment
 * section outside the detected post element (a sibling under the post's card).
 * Only composers after the post's trigger and with the same activity identity
 * qualify, so an earlier post's open composer is never returned.
 */
export function findCommentInputForPost(post: HTMLElement): HTMLElement | null {
  const identity = findPostIdentity(post)
  const trigger = findCommentTriggerForPost(post)
  const direct = findCommentInput(post)
  if (
    direct &&
    (!trigger || isComposerAfterTrigger(trigger, direct)) &&
    matchesPostIdentity(direct, identity)
  ) {
    return direct
  }

  if (!trigger) {
    if (!identity) return null
    return findVisibleCommentInputs().find(
      (input) => findPostIdentity(input) === identity,
    ) ?? null
  }

  let container: HTMLElement | null = trigger.parentElement
  while (container && container !== document.body) {
    if (isSinglePostContainer(container)) {
      const input = findCommentInput(container)
      if (
        input &&
        isComposerAfterTrigger(trigger, input) &&
        matchesPostIdentity(input, identity)
      ) {
        return input
      }
    }
    container = container.parentElement
  }

  if (identity) {
    return findVisibleCommentInputs().find(
      (input) => findPostIdentity(input) === identity,
    ) ?? null
  }

  return null
}

/**
 * Confirms a composer found near the post is owned by that post and not by a
 * sibling post inside a shared feed wrapper.
 */
export function isCommentInputOwnedByPost(
  post: HTMLElement,
  input: HTMLElement,
): boolean {
  const postIdentity = findPostIdentity(post)
  const inputIdentity = findPostIdentity(input)

  if (postIdentity && inputIdentity) {
    return postIdentity === inputIdentity
  }

  if (post.contains(input)) return true

  const trigger = findCommentTriggerForPost(post)
  if (!trigger) return false
  if (!isComposerAfterTrigger(trigger, input)) return false

  let container: HTMLElement | null = trigger.parentElement
  while (container && container !== document.body) {
    if (container.contains(input)) return isSinglePostContainer(container)
    container = container.parentElement
  }

  return false
}

/**
 * A composer that appeared only after the trigger was clicked is a safe
 * fallback when LinkedIn portals it outside the post (identity is unavailable).
 */
export function isNewComposerForPost(post: HTMLElement, input: HTMLElement): boolean {
  const postIdentity = findPostIdentity(post)
  const inputIdentity = findPostIdentity(input)

  if (postIdentity && inputIdentity) return postIdentity === inputIdentity

  const trigger = findCommentTriggerForPost(post)
  return !trigger || isComposerAfterTrigger(trigger, input)
}

function isCommentSubmitButton(button: HTMLButtonElement): boolean {
  const signal = [
    button.getAttribute("data-view-name"),
    button.getAttribute("aria-label"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return signal.includes("submit") || signal.includes("post comment")
}

function isUsableCommentTrigger(control: HTMLElement): boolean {
  if (control.classList.contains("lcg-generate-button")) return false
  if (control.closest(COMMENT_CONTENT_SELECTOR)) return false
  if (control instanceof HTMLButtonElement && isCommentSubmitButton(control)) {
    return false
  }
  return true
}

export function findCommentTrigger(post: HTMLElement): HTMLElement | null {
  for (const selector of COMMENT_TRIGGER_SELECTORS) {
    try {
      const trigger = [...post.querySelectorAll<HTMLElement>(selector)].find(
        isUsableCommentTrigger,
      )
      if (trigger) return trigger
    } catch (error) {
      logger.debug("Could not query comment triggers.", { selector, error: String(error) })
    }
  }

  for (const control of post.querySelectorAll<HTMLElement>('button, [role="button"]')) {
    if (!isUsableCommentTrigger(control)) continue

    const signal = [
      control.textContent,
      control.getAttribute("aria-label"),
      control.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()

    if (/^comment\b/.test(signal)) return control
  }

  return null
}

/**
 * Finds the comment trigger even when LinkedIn renders the action bar outside
 * the detected post element (a sibling under the post's card). Only
 * single-post ancestors are searched so another post's trigger is never used.
 */
export function findCommentTriggerForPost(post: HTMLElement): HTMLElement | null {
  const local = findCommentTrigger(post)
  if (local) return local

  let container: HTMLElement | null = post.parentElement
  while (container && container !== document.body) {
    if (isSinglePostContainer(container)) {
      const trigger = findCommentTrigger(container)
      if (trigger) return trigger
    }
    container = container.parentElement
  }

  return null
}

export function findCommentSubmitButton(post: HTMLElement): HTMLButtonElement | null {
  return queryFirst<HTMLButtonElement>(post, COMMENT_SUBMIT_SELECTORS)
}

export function findVisiblePost(): HTMLElement | null {
  const detected = findPosts(findFeedContainer() ?? document)
  const viewportCenter = window.innerHeight / 2
  const visibleDetected = detected
    .filter((post) => {
      const rect = post.getBoundingClientRect()
      return rect.bottom > 80 && rect.top < window.innerHeight && rect.width >= 280
    })
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect()
      const rightRect = right.getBoundingClientRect()
      const leftCenter = leftRect.top + leftRect.height / 2
      const rightCenter = rightRect.top + rightRect.height / 2
      return Math.abs(leftCenter - viewportCenter) - Math.abs(rightCenter - viewportCenter)
    })

  if (visibleDetected[0]) {
    return findPostContainer(visibleDetected[0]) ?? visibleDetected[0]
  }

  const centerNode = document.elementFromPoint(window.innerWidth / 2, viewportCenter)
  let candidate = centerNode instanceof HTMLElement ? centerNode : centerNode?.parentElement
  let depth = 0

  while (candidate && candidate !== document.body && depth < 14) {
    const rect = candidate.getBoundingClientRect()
    const text = candidate.innerText.trim()
    if (
      rect.width >= 280 &&
      rect.height >= 180 &&
      text.length >= 40 &&
      text.length <= 12_000
    ) {
      return findPostContainer(candidate)
    }
    candidate = candidate.parentElement
    depth += 1
  }

  return null
}

export function observeLinkedInFeed(onPostsFound: (posts: HTMLElement[]) => void): () => void {
  let frameId: number | undefined

  const scan = () => {
    frameId = undefined
    try {
      const scope = findFeedContainer() ?? document
      const posts = findPosts(scope)
      if (posts.length > 0) onPostsFound(posts)
    } catch (error) {
      logger.debug("Could not scan the feed.", { error: String(error) })
    }
  }

  const scheduleScan = () => {
    if (frameId !== undefined) return
    frameId = window.requestAnimationFrame(scan)
  }

  const observer = new MutationObserver(scheduleScan)
  const target = document.body ?? document.documentElement
  observer.observe(target, { childList: true, subtree: true })
  scheduleScan()

  return () => {
    observer.disconnect()
    if (frameId !== undefined) window.cancelAnimationFrame(frameId)
  }
}
