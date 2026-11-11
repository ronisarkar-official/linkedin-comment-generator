import { describe, expect, it } from 'vitest';
import { formatCommentWithPromo } from '../src/lib/text-utils';

describe('formatCommentWithPromo', () => {
	const baseComment = 'The 2x price of Fable 5.2 really makes the "when to switch" question key for dev budgets.';

	it('returns base comment unchanged when promotional message is undefined or empty', () => {
		expect(formatCommentWithPromo(baseComment)).toBe(baseComment);
		expect(formatCommentWithPromo(baseComment, '')).toBe(baseComment);
		expect(formatCommentWithPromo(baseComment, undefined)).toBe(baseComment);
	});

	it('returns base comment unchanged when promotional message is only whitespace', () => {
		expect(formatCommentWithPromo(baseComment, '   ')).toBe(baseComment);
		expect(formatCommentWithPromo(baseComment, '\n\t  \n')).toBe(baseComment);
	});

	it('does not insert any paragraph break by default — direct user choice', () => {
		const promo = ' promotional message';
		const result = formatCommentWithPromo(baseComment, promo);
		expect(result).toBe(`${baseComment} promotional message`);
		expect(result).not.toContain('\n');
	});

	it('creates a line break only when user adds Enter in the input box', () => {
		const promoWithEnter = '\npromotional message';
		const result = formatCommentWithPromo(baseComment, promoWithEnter);
		expect(result).toBe(`${baseComment}\npromotional message`);
	});

	it('creates a paragraph break (empty line) only when user adds two Enters in the input box', () => {
		const promoWithTwoEnters = '\n\npromotional message';
		const result = formatCommentWithPromo(baseComment, promoWithTwoEnters);
		expect(result).toBe(`${baseComment}\n\npromotional message`);
	});

	it('creates tab spacing only when user adds Tab in the input box', () => {
		const promoWithTab = '\tpromotional message';
		const result = formatCommentWithPromo(baseComment, promoWithTab);
		expect(result).toBe(`${baseComment}\tpromotional message`);
	});

	it('creates space only when user adds Spacebar in the input box', () => {
		const promoWithSpaces = '   promotional message';
		const result = formatCommentWithPromo(baseComment, promoWithSpaces);
		expect(result).toBe(`${baseComment}   promotional message`);
	});

	it('preserves combinations like Enter then Tab', () => {
		const promoWithEnterAndTab = '\n\tpromotional message';
		const result = formatCommentWithPromo(baseComment, promoWithEnterAndTab);
		expect(result).toBe(`${baseComment}\n\tpromotional message`);
	});

	it('trims trailing whitespace from both base comment and promotional message', () => {
		const commentWithTrailing = `${baseComment}  \n\n`;
		const promoWithTrailing = ' promotional message   \n';
		const result = formatCommentWithPromo(commentWithTrailing, promoWithTrailing);
		expect(result).toBe(`${baseComment} promotional message`);
	});
});
