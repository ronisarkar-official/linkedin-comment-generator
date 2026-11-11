import { beforeEach, describe, expect, it } from 'vitest';
import {
	decryptApiKeys,
	decryptSecret,
	encryptApiKeys,
	encryptSecret,
	estimateTokens,
	resetCachedKey,
} from '../src/lib/crypto';
import { buildCommentPrompt } from '../src/lib/prompt-templates';
import { DEFAULT_SETTINGS } from '../src/lib/storage';
import type { ProviderApiKeys } from '../src/lib/types';

describe('Web Crypto AES-GCM Vault', () => {
	beforeEach(() => {
		resetCachedKey();
	});

	it('encrypts and decrypts a secret key successfully', async () => {
		const rawKey = 'AIzaSyA123456789-super-secret-key';
		const encrypted = await encryptSecret(rawKey);

		expect(encrypted).not.toBe(rawKey);
		expect(encrypted.startsWith('enc:v1:')).toBe(true);

		const decrypted = await decryptSecret(encrypted);
		expect(decrypted).toBe(rawKey);
	});

	it('produces different ciphertexts for the same plaintext due to random IVs', async () => {
		const rawKey = 'sk-proj-test12345';
		const enc1 = await encryptSecret(rawKey);
		const enc2 = await encryptSecret(rawKey);

		expect(enc1).not.toBe(enc2);
		expect(await decryptSecret(enc1)).toBe(rawKey);
		expect(await decryptSecret(enc2)).toBe(rawKey);
	});

	it('transparently returns unencrypted legacy keys as-is', async () => {
		const legacyKey = 'plain-api-key-from-older-version';
		expect(await decryptSecret(legacyKey)).toBe(legacyKey);
	});

	it('handles empty or blank secrets gracefully', async () => {
		expect(await encryptSecret('')).toBe('');
		expect(await decryptSecret('')).toBe('');
	});

	it('encrypts and decrypts whole ProviderApiKeys maps', async () => {
		const original: ProviderApiKeys = {
			gemini: 'gemini-key-123',
			openai: 'sk-openai-key-456',
			anthropic: 'sk-ant-key-789',
		};

		const encrypted = await encryptApiKeys(original);
		expect(encrypted.gemini?.startsWith('enc:v1:')).toBe(true);
		expect(encrypted.openai?.startsWith('enc:v1:')).toBe(true);
		expect(encrypted.anthropic?.startsWith('enc:v1:')).toBe(true);

		const decrypted = await decryptApiKeys(encrypted);
		expect(decrypted).toEqual(original);
	});

	it('estimates tokens accurately (~4 chars/token)', () => {
		expect(estimateTokens('')).toBe(0);
		expect(estimateTokens('abcd')).toBe(1);
		expect(estimateTokens('Hello world, this is a test post for token estimation.')).toBeGreaterThan(10);
	});

	it('anonymizes author name when anonymizeAuthorName is enabled', () => {
		const bundleNormal = buildCommentPrompt(
			{
				postText: 'Great insights on engineering leadership.',
				authorName: 'Satya Nadella',
				tone: 'professional',
				length: 'medium',
			},
			{ ...DEFAULT_SETTINGS, anonymizeAuthorName: false },
			[],
		);
		expect(bundleNormal.user).toContain('<author_name>Satya Nadella</author_name>');

		const bundleAnon = buildCommentPrompt(
			{
				postText: 'Great insights on engineering leadership.',
				authorName: 'Satya Nadella',
				tone: 'professional',
				length: 'medium',
			},
			{ ...DEFAULT_SETTINGS, anonymizeAuthorName: true },
			[],
		);
		expect(bundleAnon.user).toContain('<author_name>LinkedIn Author</author_name>');
		expect(bundleAnon.user).not.toContain('Satya Nadella');
	});
});
