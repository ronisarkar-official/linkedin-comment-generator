import { beforeEach, describe, expect, it } from 'vitest';
import {
	findCommentInput,
	findCommentTrigger,
	findPostContainer,
	findPosts,
	isSinglePostContainer,
} from '../src/content/dom-selectors';
import { insertCommentIntoPost } from '../src/content/comment-box';

// jsdom does not implement innerText; the content script relies on it.
Object.defineProperty(HTMLElement.prototype, 'innerText', {
	configurable: true,
	get(this: HTMLElement) {
		return this.textContent ?? '';
	},
	set(this: HTMLElement, value: string) {
		this.textContent = value;
	},
});

function stubLayout(element: HTMLElement, top = 0): void {
	Object.defineProperty(element, 'getBoundingClientRect', {
		configurable: true,
		value: () => ({
			width: 420,
			height: 48,
			top,
			bottom: top + 48,
			left: 0,
			right: 420,
			x: 0,
			y: top,
			toJSON: () => ({}),
		}),
	});
}

function createComposer(): HTMLTextAreaElement {
	const composer = document.createElement('textarea');
	composer.placeholder = 'Add a comment…';
	stubLayout(composer);
	return composer;
}

interface PostOptions {
	open?: boolean;
	openOnTriggerAfterMs?: number;
	top?: number;
}

function createPost(id: string, options: PostOptions = {}): HTMLElement {
	const post = document.createElement('article');
	post.setAttribute('data-id', `urn:li:activity:${id}`);
	post.innerHTML = `
    <div class="update-components-text">Post ${id}</div>
    <div class="feed-shared-social-action-bar">
      <button type="button" aria-label="Comment">Comment</button>
    </div>
  `;

	const comments = document.createElement('div');
	comments.className = 'comments-comment-box';
	if (options.open) comments.append(createComposer());
	post.append(comments);

	post.querySelector('button')?.addEventListener('click', () => {
		if (options.openOnTriggerAfterMs === undefined) return;
		window.setTimeout(() => {
			comments.append(createComposer());
		}, options.openOnTriggerAfterMs);
	});

	stubLayout(post, options.top ?? 0);
	document.body.append(post);
	return post;
}

describe('comment targeting', () => {
	beforeEach(() => {
		document.body.replaceChildren();
	});

	it('ignores a composer that belongs to another post', () => {
		createPost('A', { open: true });
		const postB = createPost('B');

		expect(findCommentInput(postB)).toBeNull();
	});

	it('inserts into the target post when its composer opens after the first poll', async () => {
		const postA = createPost('A', { open: true });
		const composerA = postA.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';

		const postB = createPost('B', { openOnTriggerAfterMs: 150 });

		const inserted = await insertCommentIntoPost(postB, 'Comment for B');

		expect(inserted).toBe(true);
		expect(composerA.value).toBe('Draft for A');
		expect(postB.querySelector('textarea')?.value).toBe('Comment for B');
	});

	it('writes to the target post when both composers are open', async () => {
		const postA = createPost('A', { open: true });
		const composerA = postA.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';

		const postB = createPost('B', { open: true });

		const inserted = await insertCommentIntoPost(postB, 'Comment for B');

		expect(inserted).toBe(true);
		expect(composerA.value).toBe('Draft for A');
		expect(postB.querySelector('textarea')?.value).toBe('Comment for B');
	});

	it('refuses to insert when the target post is disconnected', async () => {
		const post = createPost('A');
		post.remove();

		await expect(insertCommentIntoPost(post, 'Comment for A')).resolves.toBe(false);
	});

	it('resolves the nearest post container instead of a feed-level wrapper', () => {
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-view-tracking-scope', '[{"transporterKeys":["feed"]}]');

		const post = document.createElement('article');
		post.setAttribute('data-id', 'urn:li:activity:A');
		post.innerHTML = '<div class="update-components-text">Post A</div>';
		wrapper.append(post);
		document.body.append(wrapper);

		expect(findPostContainer(post)).toBe(post);
		expect(findPostContainer(post.querySelector('.update-components-text')!)).toBe(post);
	});

	it('does not treat a wrapper that contains two posts as a single post', () => {
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-view-tracking-scope', '[{"transporterKeys":["feed"]}]');
		const postA = createPost('A', { open: true });
		const postB = createPost('B');
		wrapper.append(postA, postB);
		document.body.append(wrapper);

		const detected = findPosts(document.body);

		expect(detected).toHaveLength(2);
		expect(detected).not.toContain(wrapper);
		expect(detected).toContain(postA);
		expect(detected).toContain(postB);
		expect(findPostContainer(wrapper)).toBeNull();
	});

	it('refuses to insert through a wrapper that contains two posts', async () => {
		const wrapper = document.createElement('div');
		wrapper.setAttribute('data-view-tracking-scope', '[{"transporterKeys":["feed"]}]');
		const postA = createPost('A', { open: true });
		const composerA = postA.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';
		const postB = createPost('B');
		wrapper.append(postA, postB);
		document.body.append(wrapper);

		await expect(insertCommentIntoPost(wrapper, 'Comment for B')).resolves.toBe(false);
		expect(composerA.value).toBe('Draft for A');
	});

	it('allows a post that contains a nested activity container', () => {
		const post = createPost('A');
		const nested = document.createElement('div');
		nested.setAttribute('data-id', 'urn:li:activity:ORIGINAL');
		post.append(nested);

		expect(isSinglePostContainer(post)).toBe(true);
		expect(findPosts(document.body)).toContain(post);
	});

	it('ignores a composer that is mounted but not rendered', () => {
		const post = createPost('A');
		const hidden = createComposer();
		Object.defineProperty(hidden, 'getBoundingClientRect', {
			configurable: true,
			value: () => ({
				width: 0,
				height: 0,
				top: 0,
				bottom: 0,
				left: 0,
				right: 0,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			}),
		});
		post.querySelector('.comments-comment-box')?.append(hidden);

		expect(findCommentInput(post)).toBeNull();
	});

	it('finds a composer rendered outside the detected post element', async () => {
		const post = createPost('A');
		const comments = post.querySelector('.comments-comment-box');
		if (!comments) throw new Error('Comments container was not created.');

		const postWrapper = document.createElement('div');
		postWrapper.append(post, comments);
		document.body.append(postWrapper);

		const composer = createComposer();
		comments.append(composer);

		const inserted = await insertCommentIntoPost(post, 'Comment for A');

		expect(inserted).toBe(true);
		expect(composer.value).toBe('Comment for A');
	});

	it('does not fall back to another post when the target composer is outside its post', async () => {
		const postA = createPost('A', { open: true });
		const composerA = postA.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';

		const postB = createPost('B');
		const commentsB = postB.querySelector('.comments-comment-box');
		if (!commentsB) throw new Error('Post B comments container was not created.');

		const postWrapper = document.createElement('div');
		postWrapper.append(postB, commentsB);
		document.body.append(postWrapper);

		const composerB = createComposer();
		commentsB.append(composerB);

		const inserted = await insertCommentIntoPost(postB, 'Comment for B');

		expect(inserted).toBe(true);
		expect(composerA.value).toBe('Draft for A');
		expect(composerB.value).toBe('Comment for B');
	});

	it('does not count comment items as separate posts', () => {
		const post = document.createElement('article');
		post.innerHTML = '<div class="update-components-text">Post without an activity id</div>';

		for (const id of ['1', '2']) {
			const comment = document.createElement('div');
			comment.className = 'comments-comment-item';
			comment.setAttribute('data-id', `urn:li:comment:(urn:li:activity:123,${id})`);
			post.append(comment);
		}

		expect(isSinglePostContainer(post)).toBe(true);
	});

	it('does not treat the submit button as the comment trigger', () => {
		const post = createPost('A');
		const toggle = post.querySelector('button[aria-label="Comment"]');
		if (!toggle) throw new Error('Comment toggle was not created.');

		const submit = document.createElement('button');
		submit.type = 'button';
		submit.setAttribute('data-view-name', 'comment-submit');
		submit.setAttribute('aria-label', 'Post comment');
		post.append(submit);

		expect(findCommentTrigger(post)).toBe(toggle);
	});

	it('finds the comment trigger by its visible text when no aria-label is present', () => {
		const post = createPost('A');
		const toggle = post.querySelector('button[aria-label="Comment"]');
		if (!toggle) throw new Error('Comment toggle was not created.');

		toggle.removeAttribute('aria-label');
		toggle.textContent = 'Comment';

		expect(findCommentTrigger(post)).toBe(toggle);
	});

	it('finds a comment trigger rendered as a role=button control', () => {
		const post = createPost('A');
		const existing = post.querySelector('button[aria-label="Comment"]');
		if (!existing) throw new Error('Comment toggle was not created.');
		existing.remove();

		const toggle = document.createElement('div');
		toggle.setAttribute('role', 'button');
		toggle.textContent = 'Comment';
		post.querySelector('.feed-shared-social-action-bar')?.append(toggle);

		expect(findCommentTrigger(post)).toBe(toggle);
	});

	it('opens a composer when the trigger is outside the detected post element', async () => {
		const post = document.createElement('article');
		post.setAttribute('data-id', 'urn:li:activity:A');
		post.innerHTML = '<div class="update-components-text">Post A</div>';
		stubLayout(post);

		const wrapper = document.createElement('div');
		const actionBar = document.createElement('div');
		actionBar.className = 'feed-shared-social-action-bar';

		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.setAttribute('aria-label', 'Comment');
		toggle.textContent = 'Comment';
		actionBar.append(toggle);

		const comments = document.createElement('div');
		comments.className = 'comments-comment-box';

		wrapper.append(post, actionBar, comments);
		document.body.append(wrapper);

		toggle.addEventListener('click', () => {
			window.setTimeout(() => {
				comments.append(createComposer());
			}, 150);
		});

		const inserted = await insertCommentIntoPost(post, 'Comment for A');

		expect(inserted).toBe(true);
		expect(comments.querySelector('textarea')?.value).toBe('Comment for A');
	});

	it('never uses an earlier post composer found through a shared wrapper', async () => {
		const createBarePost = (id: string, open: boolean) => {
			const post = document.createElement('article');
			post.innerHTML = `<div class="update-components-text">Post ${id}</div>`;
			stubLayout(post);

			const actionBar = document.createElement('div');
			actionBar.className = 'feed-shared-social-action-bar';
			const toggle = document.createElement('button');
			toggle.type = 'button';
			toggle.setAttribute('aria-label', 'Comment');
			toggle.textContent = 'Comment';
			actionBar.append(toggle);

			const comments = document.createElement('div');
			comments.className = 'comments-comment-box';
			if (open) comments.append(createComposer());

			post.append(actionBar, comments);
			return { post, comments, toggle };
		};

		const wrapper = document.createElement('div');

		const postA = createBarePost('A', true);
		const composerA = postA.comments.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';
		wrapper.append(postA.post, postA.comments);

		const postB = createBarePost('B', false);
		postB.toggle.addEventListener('click', () => {
			window.setTimeout(() => {
				postB.comments.append(createComposer());
			}, 150);
		});
		wrapper.append(postB.post, postB.comments);

		document.body.append(wrapper);

		const inserted = await insertCommentIntoPost(postB.post, 'Comment for B');

		expect(inserted).toBe(true);
		expect(composerA.value).toBe('Draft for A');
		expect(postB.comments.querySelector('textarea')?.value).toBe('Comment for B');
	});

	it('accepts a composer that is portaled after the trigger click', async () => {
		const postA = createPost('A', { open: true });
		const composerA = postA.querySelector('textarea');
		if (!composerA) throw new Error('Post A composer was not created.');
		composerA.value = 'Draft for A';

		const postB = createPost('B');
		const toggleB = postB.querySelector('button[aria-label="Comment"]');
		if (!toggleB) throw new Error('Post B trigger was not created.');

		toggleB.addEventListener('click', () => {
			window.setTimeout(() => {
				document.body.append(createComposer());
			}, 150);
		});

		const inserted = await insertCommentIntoPost(postB, 'Comment for B');

		const portaled = [...document.body.querySelectorAll('textarea')].filter(
			(input) => input !== composerA,
		);

		expect(inserted).toBe(true);
		expect(composerA.value).toBe('Draft for A');
		expect(portaled[0]?.value).toBe('Comment for B');
	});
});
