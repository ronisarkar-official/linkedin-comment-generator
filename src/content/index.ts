import { showContentError, showVariantPicker } from "./comment-box"
import { findVisiblePost, observeLinkedInFeed } from "./dom-selectors"
import { injectGenerateButton } from "./inject-button"

const style = document.createElement("style")
style.textContent = `
  .lcg-generate-button {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 6px;
    color: #0a66c2;
    cursor: pointer;
    display: inline-flex;
    font: 600 14px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    justify-content: center;
    min-height: 40px;
    padding: 8px 12px;
  }
  .lcg-generate-button:hover { background: rgba(10, 102, 194, 0.1); }
  .lcg-generate-button:disabled { cursor: wait; opacity: 0.65; }
  .lcg-fallback-action-bar { align-items: center; border-top: 1px solid rgba(140, 140, 140, 0.2); display: flex; min-height: 44px; padding: 2px 8px; width: 100%; }
  .lcg-spinner { animation: lcg-spin 0.75s linear infinite; border: 2px solid rgba(10, 102, 194, 0.25); border-radius: 50%; border-top-color: #0a66c2; display: inline-block; height: 14px; margin-right: 7px; width: 14px; }
  .lcg-spinner-dark { border-color: rgba(95, 95, 95, 0.25); border-top-color: #5f5f5f; height: 12px; width: 12px; }
  .lcg-variant-panel {
    background: #fff;
    border: 1px solid #d6d6d6;
    border-radius: 12px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.2);
    color: #191919;
    font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    padding: 12px;
    position: fixed;
    z-index: 2147483647;
  }
  .lcg-panel-header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 8px; }
  .lcg-panel-header strong { font-size: 16px; }
  .lcg-close-button { background: transparent; border: 0; border-radius: 50%; cursor: pointer; font-size: 24px; height: 32px; line-height: 1; width: 32px; }
  .lcg-close-button:hover { background: #f3f2ef; }
  .lcg-variant-card { background: #fff; border: 1px solid #e0dfdc; border-radius: 8px; color: #191919; cursor: pointer; display: block; margin-top: 8px; padding: 10px; text-align: left; width: 100%; }
  .lcg-variant-card:hover { background: #f5f9fd; border-color: #0a66c2; }
  .lcg-variant-card:disabled { cursor: wait; opacity: 0.65; }
  .lcg-tone-label { border-radius: 999px; display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 5px; padding: 2px 7px; text-transform: uppercase; }
  .lcg-tone-professional { background: #dbeafe; color: #1e40af; }
  .lcg-tone-witty { background: #fef3c7; color: #92400e; }
  .lcg-tone-supportive { background: #dcfce7; color: #166534; }
  .lcg-variant-text { display: block; }
  .lcg-panel-status { align-items: center; color: #5f5f5f; display: flex; font-size: 12px; min-height: 17px; padding-top: 8px; }
  .lcg-panel-status-error { color: #b42318; }
  .lcg-toast { background: #fff; border-radius: 8px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2); font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 320px; padding: 12px; position: fixed; z-index: 2147483647; }
  .lcg-toast-error { border-left: 4px solid #b42318; color: #7a271a; }
  .lcg-floating-launcher { align-items: center; background: #0a66c2; border: 0; border-radius: 999px; bottom: 84px; box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28); color: #fff; cursor: pointer; display: flex; font: 700 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; gap: 7px; padding: 13px 17px; position: fixed; right: 24px; z-index: 2147483646; }
  .lcg-floating-launcher:hover { background: #004182; }
  @keyframes lcg-spin { to { transform: rotate(360deg); } }
`
document.documentElement.append(style)

let detectedPostCount = 0
let fallbackLauncher: HTMLButtonElement | null = null

const callbacks = {
  onVariants: showVariantPicker,
  onError: (_post: HTMLElement, message: string, anchor: HTMLElement) =>
    showContentError(message, anchor),
}

observeLinkedInFeed((posts) => {
  detectedPostCount = Math.max(detectedPostCount, posts.length)
  fallbackLauncher?.remove()
  fallbackLauncher = null
  posts.forEach((post) => {
    injectGenerateButton(post, callbacks)
  })
})

if (window.location.pathname.startsWith("/feed")) {
  window.setTimeout(() => {
    const hasVisibleButton = [...document.querySelectorAll<HTMLElement>(".lcg-generate-button")].some(
      (button) => {
        const rect = button.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight
      },
    )

    if (!hasVisibleButton) {
      if (detectedPostCount === 0) {
        console.warn("LinkedIn Comment Generator did not recognize any posts on this feed.")
      }
      const launcher = document.createElement("button")
      launcher.type = "button"
      launcher.className = "lcg-floating-launcher"
      launcher.textContent = "Generate Comment"
      launcher.setAttribute("aria-label", "Generate a comment for the visible LinkedIn post")
      launcher.addEventListener("click", () => {
        const post = findVisiblePost()
        if (!post) {
          showContentError("Could not identify the visible LinkedIn post. Scroll to a post and try again.", launcher)
          return
        }

        injectGenerateButton(post, callbacks)
        const generatedButton = post.querySelector<HTMLButtonElement>(".lcg-generate-button")
        if (generatedButton) {
          generatedButton.click()
          launcher.remove()
          fallbackLauncher = null
        }
      })
      document.body.append(launcher)
      fallbackLauncher = launcher
    }
  }, 3_000)
}
