import { describe, expect, it } from 'vitest';
import {
	cleanAuthorName,
	cleanPostDateText,
	extractPostTimestampFromUrn,
	extractUsernameFromUrl,
	parseRelativeTimeToMs,
} from '../src/lib/text-utils';
import { findAuthorName, findPostDate } from '../src/content/dom-selectors';

// Polyfill innerText in jsdom for tests
if (!Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerText')) {
	Object.defineProperty(HTMLElement.prototype, 'innerText', {
		configurable: true,
		get(this: HTMLElement) {
			return this.textContent ?? '';
		},
		set(this: HTMLElement, value: string) {
			this.textContent = value;
		},
	});
}

describe('cleanAuthorName', () => {
	it('extracts plain names correctly', () => {
		expect(cleanAuthorName('Satya Nadella')).toBe('Satya Nadella');
		expect(cleanAuthorName('Sundar Pichai')).toBe('Sundar Pichai');
		expect(cleanAuthorName('Amazon')).toBe('Amazon');
	});

	it('strips screen-reader View profile text', () => {
		expect(cleanAuthorName("View Satya Nadella’s profile")).toBe('Satya Nadella');
		expect(cleanAuthorName("View John Doe's profile")).toBe('John Doe');
		expect(cleanAuthorName("Satya Nadella\nView Satya Nadella’s profile")).toBe('Satya Nadella');
	});

	it('strips connection degree and author badges', () => {
		expect(cleanAuthorName('John Doe • 1st')).toBe('John Doe');
		expect(cleanAuthorName('Jane Smith • 2nd')).toBe('Jane Smith');
		expect(cleanAuthorName('Bob Vance • 3rd+')).toBe('Bob Vance');
		expect(cleanAuthorName('Alice Wonder • Following')).toBe('Alice Wonder');
		expect(cleanAuthorName('Acme Corp • Author')).toBe('Acme Corp');
	});

	it('strips relative timestamps and pronouns', () => {
		expect(cleanAuthorName('Sarah Connor (She/Her) • 2h')).toBe('Sarah Connor');
		expect(cleanAuthorName('David Miller (He/Him) • 1w • Edited')).toBe('David Miller');
	});

	it('strips avatar alt image prefixes', () => {
		expect(cleanAuthorName('Photo of Satya Nadella')).toBe('Satya Nadella');
		expect(cleanAuthorName('Image of Sundar Pichai')).toBe('Sundar Pichai');
		expect(cleanAuthorName('Logo for Google')).toBe('Google');
	});

	it('rejects generic or noise labels', () => {
		expect(cleanAuthorName('')).toBeUndefined();
		expect(cleanAuthorName('   ')).toBeUndefined();
		expect(cleanAuthorName('• 2h')).toBeUndefined();
		expect(cleanAuthorName('LinkedIn')).toBeUndefined();
		expect(cleanAuthorName('Promoted')).toBeUndefined();
		expect(cleanAuthorName('Following')).toBeUndefined();
	});
});

describe('extractUsernameFromUrl', () => {
	it('extracts vanity usernames from personal profile URLs', () => {
		expect(extractUsernameFromUrl('https://www.linkedin.com/in/satyanadella/')).toBe('satyanadella');
		expect(extractUsernameFromUrl('https://www.linkedin.com/in/ronis-patel-123456?miniProfileUrn=...')).toBe('ronis-patel-123456');
	});

	it('extracts company handles from company URLs', () => {
		expect(extractUsernameFromUrl('https://www.linkedin.com/company/amazon/')).toBe('amazon');
		expect(extractUsernameFromUrl('https://www.linkedin.com/company/google/posts/?feedView=all')).toBe('google');
	});

	it('extracts author slug from LinkedIn post permalinks', () => {
		expect(
			extractUsernameFromUrl('https://www.linkedin.com/posts/satyanadella_ai-advancements-activity-71234567890-abcd'),
		).toBe('satyanadella');
	});

	it('returns undefined for non-user URLs or invalid formats', () => {
		expect(extractUsernameFromUrl(undefined)).toBeUndefined();
		expect(extractUsernameFromUrl('')).toBeUndefined();
		expect(extractUsernameFromUrl('https://www.linkedin.com/feed/update/urn:li:activity:71234567890/')).toBeUndefined();
	});
});

describe('findAuthorName DOM extraction', () => {
	it('extracts author from modern update-components-actor title', () => {
		const post = document.createElement('article');
		post.innerHTML = `
			<button aria-label="Control menu"><span aria-hidden="true"><svg></svg></span></button>
			<div class="update-components-actor">
				<a class="update-components-actor__meta-link" href="https://www.linkedin.com/in/johndoe/">
					<span class="update-components-actor__title">
						<span dir="ltr">
							<span aria-hidden="true">John Doe</span>
							<span class="visually-hidden">View John Doe’s profile</span>
						</span>
					</span>
				</a>
			</div>
			<div class="update-components-text">Great insight on AI models!</div>
		`;

		expect(findAuthorName(post)).toBe('John Doe');
	});

	it('extracts author from feed-shared-actor title with connection degree', () => {
		const post = document.createElement('div');
		post.innerHTML = `
			<div class="feed-shared-actor">
				<a class="feed-shared-actor__container-link" href="https://www.linkedin.com/in/alicesmith/">
					<span class="feed-shared-actor__title">Alice Smith • 2nd</span>
				</a>
			</div>
			<div class="feed-shared-text">Exciting cloud architectures.</div>
		`;

		expect(findAuthorName(post)).toBe('Alice Smith');
	});

	it('extracts author from company post', () => {
		const post = document.createElement('article');
		post.innerHTML = `
			<div class="update-components-actor">
				<a class="update-components-actor__meta-link" href="https://www.linkedin.com/company/amazon/">
					<span class="update-components-actor__title">Amazon</span>
				</a>
			</div>
			<div class="update-components-text">Amazon swapped Claude Sonnet 4.6 for a model that cannot even...</div>
		`;

		expect(findAuthorName(post)).toBe('Amazon');
	});

	it('falls back to avatar image alt text when title text is missing', () => {
		const post = document.createElement('article');
		post.innerHTML = `
			<div class="update-components-actor">
				<a class="update-components-actor__image" href="/in/charliebrown/">
					<img class="update-components-actor__avatar-image" alt="Photo of Charlie Brown" src="avatar.jpg" />
				</a>
			</div>
			<div class="update-components-text">Hello world!</div>
		`;

		expect(findAuthorName(post)).toBe('Charlie Brown');
	});

	it('falls back to URL slug when title and alt are missing', () => {
		const post = document.createElement('article');
		post.innerHTML = `
			<div class="actor">
				<a href="https://www.linkedin.com/in/tech-lead-123/"></a>
			</div>
			<div class="update-components-text">Check this out.</div>
		`;

		expect(findAuthorName(post)).toBe('tech-lead-123');
	});

	it('does not get fooled by empty icons with aria-hidden="true" at the top', () => {
		const post = document.createElement('article');
		post.innerHTML = `
			<div class="feed-shared-control-menu">
				<span aria-hidden="true"></span>
				<span aria-hidden="true">   </span>
			</div>
			<div class="update-components-actor">
				<span class="update-components-actor__title">
					<span aria-hidden="true">Guillermo Rauch</span>
				</span>
			</div>
		`;

		expect(findAuthorName(post)).toBe('Guillermo Rauch');
	});
});

describe('Post Date Extraction Engine', () => {
	it('extracts exact timestamp from LinkedIn Snowflake activity URN', () => {
		const ts = extractPostTimestampFromUrn('urn:li:activity:7260589624536768512');
		expect(ts).toBe(1731059461721);
		expect(new Date(ts!).toISOString()).toBe('2024-11-08T09:51:01.721Z');
	});

	it('cleans relative post date text from DOM', () => {
		expect(cleanPostDateText('2h • Edited • ')).toBe('2h');
		expect(cleanPostDateText('3d • Public')).toBe('3d');
		expect(cleanPostDateText('1w')).toBe('1w');
		expect(cleanPostDateText('2 hours ago • Edited')).toBe('2 hours ago');
		expect(cleanPostDateText('Just now')).toBe('Just now');
	});

	it('parses relative time to approximate ms', () => {
		const now = 1700000000000;
		expect(parseRelativeTimeToMs('2h', now)).toBe(now - 2 * 3600 * 1000);
		expect(parseRelativeTimeToMs('3d', now)).toBe(now - 3 * 86400 * 1000);
		expect(parseRelativeTimeToMs('1w', now)).toBe(now - 7 * 86400 * 1000);
	});

	it('findPostDate extracts both Snowflake timestamp and DOM relative text', () => {
		const post = document.createElement('article');
		post.setAttribute('data-id', 'urn:li:activity:7260589624536768512');
		post.innerHTML = `
			<div class="update-components-actor__sub-description">
				<span aria-hidden="true">2h • Edited • </span>
			</div>
		`;

		const res = findPostDate(post, 'urn:li:activity:7260589624536768512');
		expect(res.postDate).toBe('2h');
		expect(res.postTimestamp).toBe(1731059461721);
	});

	it('findPostDate extracts from <time> element datetime attribute', () => {
		const post = document.createElement('div');
		post.innerHTML = `
			<time datetime="2024-11-08T09:51:00Z">2h</time>
		`;

		const res = findPostDate(post);
		expect(res.postDate).toBe('2h');
		expect(res.postTimestamp).toBe(new Date('2024-11-08T09:51:00Z').getTime());
	});
});

