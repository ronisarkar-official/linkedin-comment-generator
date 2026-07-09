# Privacy Policy — LinkedIn Comment Generator

**Last updated:** July 9, 2026

## Overview

LinkedIn Comment Generator is a browser extension that helps users generate AI-powered comment drafts for LinkedIn posts. We are committed to protecting your privacy and being transparent about our data practices.

## Data Collection & Usage

### Data We Access

| Data | Purpose | Stored? | Sent Externally? |
|---|---|---|---|
| LinkedIn post text | Sent to your chosen AI provider to generate relevant comments | No | Yes — to the AI provider you configure |
| Author name (if visible) | Provides context for comment generation | No | Yes — to the AI provider you configure |
| API key | Authenticates requests to your chosen AI provider | Locally only | Yes — sent as an authentication header to the provider |
| Tone & length preferences | Customizes generated comments to your style | Locally only | Yes — sent as parameters to the AI provider |
| Comment generation history | Lets you review and reuse past generated comments | Locally only (up to 50 entries) | No |

### Data We Do NOT Collect

- We do **not** collect personal information (name, email, address)
- We do **not** collect browsing history
- We do **not** collect financial or payment information
- We do **not** track your activity across websites
- We do **not** use cookies or analytics
- We do **not** sell, share, or monetize any user data

## Data Storage

All user data (API keys, preferences, and comment history) is stored **locally** in your browser using `chrome.storage.local`. This data:

- Never leaves your device except when making AI generation requests
- Is not synced across devices
- Is automatically deleted when you uninstall the extension
- Can be manually cleared by removing the extension's storage data

## Third-Party Services

When you request a comment generation, the extension sends the LinkedIn post text directly to your configured AI provider. The extension supports the following providers:

- Google Gemini (generativelanguage.googleapis.com)
- OpenRouter (openrouter.ai)
- OpenAI (api.openai.com)
- Anthropic (api.anthropic.com)
- Groq (api.groq.com)
- Together AI (api.together.xyz)
- Mistral AI (api.mistral.ai)
- DeepSeek (api.deepseek.com)
- Cohere (api.cohere.com)
- Perplexity (api.perplexity.ai)
- xAI (api.x.ai)

Each provider has its own privacy policy. We encourage you to review the privacy terms of your chosen provider.

**Important:** The extension communicates directly with these providers — there is no intermediary server operated by us.

## No Intermediary Server

This extension does **not** operate any backend server, proxy, or intermediary service. All API requests go directly from the extension's background service worker to your chosen AI provider.

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be reflected in the "Last updated" date above and published in this repository.

## Data Deletion

To delete all data stored by this extension:
1. Right-click the extension icon → **Remove from Chrome/Edge**
2. Or go to `chrome://extensions`, find LinkedIn Comment Generator, and click **Remove**

All locally stored data is permanently deleted upon uninstallation.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository:

**GitHub:** [https://github.com/ronisarkar-official/linkedin-comment-generator/issues](https://github.com/ronisarkar-official/linkedin-comment-generator/issues)
