import type {
	CommentVariant,
	GenerateCommentsFailure,
	GetSettingsResponse,
	GenerateCommentsResponse,
} from '../lib/types';
import {
	findActionBar,
	findAuthorName,
	findPostContainer,
	findPostDate,
	findPostIdentity,
	findPostText,
	findPostUrl,
} from './dom-selectors';

const INJECTED_ATTRIBUTE = 'data-lcg-injected';

export type RefineCallback = (directive: string) => Promise<CommentVariant[] | string>;

export interface InjectionCallbacks {
	onVariants: (
		post: HTMLElement,
		variants: CommentVariant[],
		anchor: HTMLElement,
		onRefine?: RefineCallback,
		promotionalMessage?: string,
	) => void;
	onError: (post: HTMLElement, message: string, anchor: HTMLElement) => void;
}

function setLoading(button: HTMLButtonElement, loading: boolean): void {
	button.disabled = loading;
	button.setAttribute('aria-busy', String(loading));
	button.replaceChildren();

	if (loading) {
		const spinner = document.createElement('span');
		spinner.className = 'lcg-spinner';
		spinner.setAttribute('aria-hidden', 'true');
		const label = document.createElement('span');
		label.textContent = 'Generating…';
		button.append(spinner, label);
		return;
	}

	button.textContent = 'Generate Comment';
}

function getFailureMessage(failure: GenerateCommentsFailure): string {
	switch (failure.error.code) {
		case 'MISSING_API_KEY':
			return 'Add an API key for the selected provider in the extension popup first.';
		case 'INVALID_API_KEY':
			return 'The selected AI provider rejected the API key. Update it in the extension popup.';
		case 'RATE_LIMITED':
			return failure.error.retryAfter ?
					`AI provider rate limit reached. Try again in ${failure.error.retryAfter} seconds.`
				:	'AI provider rate limit reached. Please wait and try again.';
		case 'NETWORK_ERROR':
			return 'Could not reach the selected AI provider. Check your connection and try again.';
		default:
			return failure.error.message;
	}
}

function sendGenerateRequest(
	postText: string,
	authorName: string | undefined,
	tone: string,
	length: string,
	customDirective?: string,
	postUrl?: string,
	postUrn?: string,
	postDate?: string,
	postTimestamp?: number,
): Promise<GenerateCommentsResponse> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{
				action: 'GENERATE_COMMENTS',
				payload: {
					postText,
					authorName,
					tone,
					length,
					customDirective,
					postUrl,
					postUrn,
					postDate,
					postTimestamp,
				},
			},
			(response: GenerateCommentsResponse | undefined) => {
				const runtimeError = chrome.runtime.lastError;
				if (runtimeError) {
					reject(new Error(runtimeError.message));
					return;
				}
				if (!response) {
					reject(
						new Error('The extension background service did not respond.'),
					);
					return;
				}
				resolve(response);
			},
		);
	});
}

function requestSettings(): Promise<{
	defaultTone: string;
	commentLength: string;
	promotionalMessage: string;
}> {
	return new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(
			{ action: 'GET_SETTINGS' },
			(response: GetSettingsResponse | undefined) => {
				const runtimeError = chrome.runtime.lastError;
				if (runtimeError) {
					reject(new Error(runtimeError.message));
					return;
				}
				if (!response?.settings) {
					reject(
						new Error(
							'The extension background service did not return settings.',
						),
					);
					return;
				}

				resolve({
					defaultTone: response.settings.defaultTone,
					commentLength: response.settings.commentLength,
					promotionalMessage: response.settings.promotionalMessage ?? '',
				});
			},
		);
	});
}

export function injectGenerateButton(
	post: HTMLElement,
	callbacks: InjectionCallbacks,
): void {
	post = findPostContainer(post) ?? post;

	const existingButtons = [
		...post.querySelectorAll<HTMLButtonElement>('.lcg-generate-button'),
	];
	if (existingButtons.length > 0) {
		existingButtons.slice(1).forEach((button) => button.remove());
		post.setAttribute(INJECTED_ATTRIBUTE, 'true');
		return;
	}

	if (post.hasAttribute(INJECTED_ATTRIBUTE)) {
		post.removeAttribute(INJECTED_ATTRIBUTE);
	}

	let actionBar = findActionBar(post);
	if (!actionBar) {
		actionBar = document.createElement('div');
		actionBar.className = 'lcg-fallback-action-bar';
		actionBar.setAttribute('data-lcg-fallback-action-bar', 'true');
		post.append(actionBar);
	}

	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'lcg-generate-button';
	button.textContent = 'Generate Comment';
	button.setAttribute('aria-label', 'Generate LinkedIn comment variants');

	button.addEventListener('click', async () => {
		const postText = findPostText(post);
		if (!postText) {
			callbacks.onError(post, 'Could not read this LinkedIn post.', button);
			return;
		}

		setLoading(button, true);
		try {
			const settings = await requestSettings();
			const authorName = findAuthorName(post);
			const postUrl = findPostUrl(post);
			const postUrn = findPostIdentity(post) || undefined;
			const { postDate, postTimestamp } = findPostDate(post, postUrn, postUrl);

			const response = await sendGenerateRequest(
				postText,
				authorName,
				settings.defaultTone,
				settings.commentLength,
				undefined,
				postUrl,
				postUrn,
				postDate,
				postTimestamp,
			);

			if (!response.ok) {
				callbacks.onError(post, getFailureMessage(response), button);
				return;
			}

			const onRefine: RefineCallback = async (directive: string) => {
				try {
					const latestSettings = await requestSettings();
					const res = await sendGenerateRequest(
						postText,
						authorName,
						latestSettings.defaultTone,
						latestSettings.commentLength,
						directive,
						postUrl,
						postUrn,
						postDate,
						postTimestamp,
					);
					if (!res.ok) return getFailureMessage(res);
					return res.variants;
				} catch (err) {
					return err instanceof Error ? err.message : 'Could not refine comments.';
				}
			};

			callbacks.onVariants(
				post,
				response.variants,
				button,
				onRefine,
				settings.promotionalMessage,
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Could not generate comments.';
			callbacks.onError(post, message, button);
		} finally {
			setLoading(button, false);
		}
	});

	actionBar.append(button);
	post.setAttribute(INJECTED_ATTRIBUTE, 'true');
}
