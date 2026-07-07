import type { CommentVariant } from '../lib/types';
import {
	findCommentInput,
	findCommentTrigger,
	findVisiblePost,
} from './dom-selectors';
import type { RefineCallback } from './inject-button';

const toneLabels: Record<string, string> = {
	professional: 'Professional',
	witty: 'Witty',
	supportive: 'Supportive',
};

const congratulationLabels = {
	true: 'Congratulatory',
	false: 'Direct',
} as const;

let activePanel: HTMLElement | null = null;
let activePanelCleanup: (() => void) | null = null;

function waitForCommentInput(post: HTMLElement): Promise<HTMLElement | null> {
	const existing = findCommentInput(post);
	if (existing) return Promise.resolve(existing);

	findCommentTrigger(post)?.click();

	return new Promise((resolve) => {
		let attempts = 0;
		const timer = window.setInterval(() => {
			const input = findCommentInput(post);
			attempts += 1;
			if (input || attempts >= 25) {
				window.clearInterval(timer);
				resolve(input);
			}
		}, 100);
	});
}

function readInputText(input: HTMLElement): string {
	if (
		input instanceof HTMLTextAreaElement ||
		input instanceof HTMLInputElement
	) {
		return input.value;
	}
	return input.innerText || input.textContent || '';
}

function normalizeText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function dispatchEditorInput(input: HTMLElement, text: string): void {
	input.dispatchEvent(
		new InputEvent('input', {
			bubbles: true,
			composed: true,
			inputType: 'insertText',
			data: text,
		}),
	);
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

function writeToNativeInput(
	input: HTMLTextAreaElement | HTMLInputElement,
	text: string,
): void {
	const prototype =
		input instanceof HTMLTextAreaElement ?
			HTMLTextAreaElement.prototype
		:	HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
	setter?.call(input, text);
	dispatchEditorInput(input, text);
}

function writeToContentEditable(input: HTMLElement, text: string): void {
	input.focus({ preventScroll: true });

	const selection = window.getSelection();
	const range = document.createRange();
	range.selectNodeContents(input);
	selection?.removeAllRanges();
	selection?.addRange(range);

	input.dispatchEvent(
		new InputEvent('beforeinput', {
			bubbles: true,
			cancelable: true,
			composed: true,
			inputType: 'insertText',
			data: text,
		}),
	);

	const inserted = document.execCommand('insertText', false, text);
	if (
		!inserted ||
		normalizeText(readInputText(input)) !== normalizeText(text)
	) {
		range.deleteContents();
		const textNode = document.createTextNode(text);
		range.insertNode(textNode);
		range.setStartAfter(textNode);
		range.collapse(true);
		selection?.removeAllRanges();
		selection?.addRange(range);
	}

	dispatchEditorInput(input, text);
}

async function insertCommentText(
	input: HTMLElement,
	text: string,
): Promise<boolean> {
	if (
		input instanceof HTMLTextAreaElement ||
		input instanceof HTMLInputElement
	) {
		input.focus({ preventScroll: true });
		writeToNativeInput(input, text);
	} else {
		writeToContentEditable(input, text);
	}

	await new Promise<void>((resolve) =>
		window.requestAnimationFrame(() => resolve()),
	);
	if (normalizeText(readInputText(input)).includes(normalizeText(text)))
		return true;

	if (
		input instanceof HTMLTextAreaElement ||
		input instanceof HTMLInputElement
	) {
		writeToNativeInput(input, text);
	} else {
		input.focus({ preventScroll: true });
		input.replaceChildren(document.createTextNode(text));
		dispatchEditorInput(input, text);
	}

	await new Promise<void>((resolve) =>
		window.requestAnimationFrame(() => resolve()),
	);
	return normalizeText(readInputText(input)).includes(normalizeText(text));
}

export async function insertCommentIntoVisiblePost(text: string): Promise<boolean> {
	const post = findVisiblePost();
	if (!post) return false;

	const input = await waitForCommentInput(post);
	if (!input) return false;

	return insertCommentText(input, text);
}

function positionPanel(panel: HTMLElement, anchor: HTMLElement): void {
	const rect = anchor.getBoundingClientRect();
	const width = Math.min(380, window.innerWidth - 24);
	const left = Math.min(
		Math.max(12, rect.left),
		window.innerWidth - width - 12,
	);
	const estimatedHeight = 330;
	const preferredTop = rect.bottom + 8;
	const top =
		preferredTop + estimatedHeight < window.innerHeight ?
			preferredTop
		:	Math.max(12, rect.top - estimatedHeight - 8);

	panel.style.width = `${width}px`;
	panel.style.left = `${left}px`;
	panel.style.top = `${top}px`;
}

function closeActivePanel(): void {
	activePanelCleanup?.();
	activePanelCleanup = null;
	activePanel?.remove();
	activePanel = null;
}

export function showVariantPicker(
	post: HTMLElement,
	variants: CommentVariant[],
	anchor: HTMLElement,
	onRefine?: RefineCallback,
): void {
	closeActivePanel();

	const panel = document.createElement('section');
	panel.className = 'lcg-variant-panel';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', 'Generated comment variants');
	panel.setAttribute('aria-modal', 'true');

	const header = document.createElement('div');
	header.className = 'lcg-panel-header';

	const title = document.createElement('strong');
	title.textContent = 'Choose a comment';

	const closeButton = document.createElement('button');
	closeButton.type = 'button';
	closeButton.className = 'lcg-close-button';
	closeButton.textContent = '×';
	closeButton.setAttribute('aria-label', 'Close generated comments');
	closeButton.addEventListener('click', closeActivePanel);

	header.append(title, closeButton);
	panel.append(header);

	const status = document.createElement('div');
	status.className = 'lcg-panel-status';
	status.setAttribute('aria-live', 'polite');

	const cardsContainer = document.createElement('div');
	cardsContainer.className = 'lcg-cards-container';

	const renderCards = (currentVariants: CommentVariant[]) => {
		cardsContainer.replaceChildren();
		currentVariants.forEach((variant) => {
			const card = document.createElement('button');
			card.type = 'button';
			card.className = 'lcg-variant-card';

			const label = document.createElement('span');
			const toneKey = variant.tone.toLowerCase();
			const isBuiltin = ['professional', 'witty', 'supportive'].includes(toneKey);
			label.className = `lcg-tone-label ${isBuiltin ? `lcg-tone-${toneKey}` : 'lcg-tone-custom'}`;
			label.textContent = toneLabels[toneKey] || (variant.tone.charAt(0).toUpperCase() + variant.tone.slice(1));

			const congratulation = document.createElement('span');
			congratulation.className = 'lcg-congratulation-label';
			congratulation.textContent =
				variant.congratulation ?
					congratulationLabels.true
				:	congratulationLabels.false;

			const text = document.createElement('span');
			text.className = 'lcg-variant-text';
			text.textContent = variant.text;

			card.append(label, congratulation, text);
			card.addEventListener('click', async () => {
				panel.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
					button.disabled = true;
				});
				status.replaceChildren();
				const spinner = document.createElement('span');
				spinner.className = 'lcg-spinner lcg-spinner-dark';
				spinner.setAttribute('aria-hidden', 'true');
				const statusText = document.createElement('span');
				statusText.textContent = 'Opening the LinkedIn comment box…';
				status.append(spinner, statusText);

				const input = await waitForCommentInput(post);
				if (!input) {
					panel
						.querySelectorAll<HTMLButtonElement>('button')
						.forEach((button) => {
							button.disabled = false;
						});
					status.textContent =
						"Could not find LinkedIn's comment box. Open it manually and try again.";
					status.classList.add('lcg-panel-status-error');
					return;
				}

				const inserted = await insertCommentText(input, variant.text);
				if (!inserted) {
					panel
						.querySelectorAll<HTMLButtonElement>('button')
						.forEach((button) => {
							button.disabled = false;
						});
					status.textContent =
						'LinkedIn rejected the inserted text. Click inside the comment box and try again.';
					status.classList.add('lcg-panel-status-error');
					return;
				}

				closeActivePanel();
			});

			cardsContainer.append(card);
		});
	};

	if (onRefine) {
		const refineBar = document.createElement('div');
		refineBar.className = 'lcg-refine-bar';

		const inputRow = document.createElement('div');
		inputRow.className = 'lcg-refine-input-row';

		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'lcg-refine-input';
		input.placeholder = 'Guide AI (e.g. "Mention Kubernetes")...';
		input.maxLength = 500;

		const refineBtn = document.createElement('button');
		refineBtn.type = 'button';
		refineBtn.className = 'lcg-refine-btn';
		refineBtn.textContent = 'Refine';

		const pillsRow = document.createElement('div');
		pillsRow.className = 'lcg-pills-row';

		const pills = [
			{ label: '✨ Shorter', directive: 'Make all comments much shorter and more concise.' },
			{ label: '❓ Ask a Question', directive: 'End at least one comment with an insightful question.' },
			{ label: '👔 More Casual', directive: 'Make the tone more conversational and casual.' },
			{ label: '🔄 Fresh Angle', directive: 'Take a completely different, fresh perspective on this post.' },
		];

		const triggerRefine = async (directiveText: string) => {
			if (!directiveText.trim()) return;
			input.disabled = true;
			refineBtn.disabled = true;
			pillsRow.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));

			status.replaceChildren();
			const spinner = document.createElement('span');
			spinner.className = 'lcg-spinner lcg-spinner-dark';
			spinner.setAttribute('aria-hidden', 'true');
			const statusText = document.createElement('span');
			statusText.textContent = 'Refining comments...';
			status.append(spinner, statusText);

			const result = await onRefine(directiveText);

			input.disabled = false;
			refineBtn.disabled = false;
			pillsRow.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = false));
			input.value = '';

			if (typeof result === 'string') {
				status.replaceChildren();
				status.textContent = result;
				status.classList.add('lcg-panel-status-error');
			} else {
				status.replaceChildren();
				status.classList.remove('lcg-panel-status-error');
				renderCards(result);
			}
		};

		refineBtn.addEventListener('click', () => triggerRefine(input.value));
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') triggerRefine(input.value);
		});

		pills.forEach((p) => {
			const pillBtn = document.createElement('button');
			pillBtn.type = 'button';
			pillBtn.className = 'lcg-pill';
			pillBtn.textContent = p.label;
			pillBtn.addEventListener('click', () => triggerRefine(p.directive));
			pillsRow.append(pillBtn);
		});

		inputRow.append(input, refineBtn);
		refineBar.append(inputRow, pillsRow);
		panel.append(refineBar);
	}

	renderCards(variants);
	panel.append(cardsContainer, status);
	document.body.append(panel);
	positionPanel(panel, anchor);
	activePanel = panel;

	// Focus the close button on open for accessibility
	closeButton.focus();

	// Set up event listeners with proper cleanup
	const handleEscape = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			event.stopPropagation();
			closeActivePanel();
		}
	};

	const handleOutsideClick = (event: MouseEvent) => {
		if (!panel.contains(event.target as Node) && event.target !== anchor) {
			closeActivePanel();
		}
	};

	// Use setTimeout(0) to avoid catching the opening click
	const outsideClickTimer = window.setTimeout(() => {
		document.addEventListener('click', handleOutsideClick, true);
	});

	document.addEventListener('keydown', handleEscape, true);

	// Store cleanup function so closeActivePanel can remove listeners
	activePanelCleanup = () => {
		window.clearTimeout(outsideClickTimer);
		document.removeEventListener('click', handleOutsideClick, true);
		document.removeEventListener('keydown', handleEscape, true);
	};
}

export function showContentError(message: string, anchor: HTMLElement): void {
	const toast = document.createElement('div');
	toast.className = 'lcg-toast lcg-toast-error';
	toast.setAttribute('role', 'alert');
	toast.textContent = message;
	document.body.append(toast);

	const rect = anchor.getBoundingClientRect();
	toast.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 332))}px`;
	toast.style.top = `${Math.min(window.innerHeight - 72, rect.bottom + 8)}px`;

	window.setTimeout(() => toast.remove(), 5000);
}
