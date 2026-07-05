# LinkedIn Comment Generator

LinkedIn Comment Generator is a Manifest V3 Chrome extension that adds a **Generate Comment** control to supported LinkedIn posts. It sends post text through the background service worker to Gemini or OpenRouter, presents professional, witty, and supportive variants, and inserts the selected text into LinkedIn's comment editor.

## Build

Requirements:

- Node.js 20.19 or newer
- npm 10 or newer

Run:

```bash
npm install
npm run build
```

The production extension is emitted to `dist/`. The build performs strict TypeScript checking before Vite and CRXJS package the MV3 entries.

For local development:

```bash
npm run dev
```

## Load the unpacked extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project's `dist` directory.
5. Open `https://www.linkedin.com/feed/` and reload the tab after the first install.
6. Open the extension popup, add the API key, and save the preferred tone and length.

After source changes, run `npm run build`, select **Reload** on the extension card, and reload LinkedIn.

## API key setup

1. Create a Gemini API key in Google AI Studio or an OpenRouter API key.
2. Open the extension popup.
3. Select the matching provider, paste its key, and select **Save**.

The key is stored only in `chrome.storage.local`. It is read by the background service worker and sent to Google's API in the `x-goog-api-key` request header. The content script and popup never call the LLM API.

## Permissions

- `storage`: stores the API key, provider, tone, comment length, and up to 50 recent generations locally.
- `activeTab`: supports user-initiated interaction with the active LinkedIn tab.
- `scripting`: reserved for extension-managed page integration required by the product specification.
- `https://www.linkedin.com/*`: lets the content script identify posts, render controls, and insert selected text.
- `https://generativelanguage.googleapis.com/*`: lets the background service worker call Gemini.
- `https://openrouter.ai/*`: lets the background service worker call OpenRouter. No LLM requests originate from the page context.

## Chrome Web Store checklist

- Create 1280 × 800 or 640 × 400 screenshots showing the popup, injected button, variant picker, and inserted comment.
- Prepare a 440 × 280 promotional tile if the listing uses one.
- Verify `icon16.png`, `icon48.png`, and `icon128.png` on light and dark browser themes.
- Host a public privacy policy and add its URL to the listing.
- Complete the data-use disclosure for LinkedIn post text and the user-provided provider API key.
- Confirm that no remotely hosted code, `eval`, or inline executable script is used.
- Run `npm audit`, perform a clean production build, and smoke-test the unpacked `dist/` directory in the current stable Chrome release.

Suggested single-purpose statement:

> Generate tone-matched LinkedIn comment drafts and insert the user's selected draft into LinkedIn's comment editor.

Suggested permission justification:

> Storage saves the user's API key and writing preferences locally. LinkedIn host access is required to detect visible posts and insert a selected draft. Google Generative Language host access is required for the background service worker to request generated drafts. Active Tab and Scripting support the user-initiated LinkedIn page integration.

## Privacy policy stub

LinkedIn Comment Generator stores settings and generation history locally in the user's Chrome profile. When the user requests comments, the visible post text, optional visible author name, tone, and desired length are sent directly from the extension background service worker to the configured LLM provider. The extension does not operate an intermediary server, sell data, or use data for advertising. Users can remove stored data by uninstalling the extension or clearing its extension storage. The production policy must identify the LLM provider, link to its privacy terms, state retention behavior, provide a contact method, and describe deletion requests.

## Known fragile points

- LinkedIn changes class names and editor structure frequently. Maintain all fallbacks in `src/content/dom-selectors.ts` and retest the feed, profile activity pages, promoted posts, and reposts.
- LinkedIn's contenteditable implementation may change how synthetic `InputEvent` updates are recognized.
- The content script permits five generation requests per rolling minute and debounces the same post for eight seconds. Providers apply separate quotas and may return `429` responses.
- Gemini model availability and free-tier quotas can change; retest the configured model before each release.
- OpenRouter's free router can change its underlying model based on current availability.
