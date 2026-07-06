import type { CommentVariant, Tone } from '../lib/types';
import { findCommentInput, findCommentTrigger } from './dom-selectors';

const toneLabels: Record<Tone, string> = {
	professional: 'Professional',
	witty: 'Witty',
	supportive: 'Supportive',
};

const congratulationLabels = {
	true: 'Congratulatory',
	false: 'Direct',
} as const;

let activePanel: HTMLElement | null = null;

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
	activePanel?.remove();
	activePanel = null;
}

export function showVariantPicker(
	post: HTMLElement,
	variants: CommentVariant[],
	anchor: HTMLElement,
): void {
	closeActivePanel();

	const panel = document.createElement('section');
	panel.className = 'lcg-variant-panel';
	panel.setAttribute('role', 'dialog');
	panel.setAttribute('aria-label', 'Generated comment variants');

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

	variants.forEach((variant) => {
		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'lcg-variant-card';

		const label = document.createElement('span');
		label.className = `lcg-tone-label lcg-tone-${variant.tone}`;
		label.textContent = toneLabels[variant.tone];

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

		panel.append(card);
	});

	panel.append(status);
	document.body.append(panel);
	positionPanel(panel, anchor);
	activePanel = panel;

	window.setTimeout(() => {
		const closeOnOutsideClick = (event: MouseEvent) => {
			if (!panel.contains(event.target as Node) && event.target !== anchor) {
				closeActivePanel();
				document.removeEventListener('click', closeOnOutsideClick, true);
			}
		};
		document.addEventListener('click', closeOnOutsideClick, true);
	});
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
