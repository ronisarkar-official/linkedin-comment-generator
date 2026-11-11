import type { LlmProvider, ProviderApiKeys } from './types';

const ENCRYPTION_PREFIX = 'enc:v1:';
const MASTER_KEY_STORAGE_KEY = '_lcg_vault_seed';

let cachedKey: CryptoKey | null = null;

function uint8ToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Retrieves or generates an AES-GCM-256 master vault key.
 * Uses an instance seed stored in chrome.storage.local for persistence.
 */
export async function getOrCreateVaultKey(): Promise<CryptoKey> {
	if (cachedKey) return cachedKey;

	let seedB64: string | undefined;
	try {
		if (typeof chrome !== 'undefined' && chrome.storage?.local) {
			const res = await chrome.storage.local.get(MASTER_KEY_STORAGE_KEY);
			seedB64 = res[MASTER_KEY_STORAGE_KEY] as string | undefined;
		}
	} catch {
		// Ignore storage lookup errors in non-extension environments (e.g. tests)
	}

	let seed: Uint8Array;
	if (seedB64) {
		try {
			seed = base64ToUint8(seedB64);
		} catch {
			seed = globalThis.crypto.getRandomValues(new Uint8Array(32));
		}
	} else {
		seed = globalThis.crypto.getRandomValues(new Uint8Array(32));
		try {
			if (typeof chrome !== 'undefined' && chrome.storage?.local) {
				await chrome.storage.local.set({
					[MASTER_KEY_STORAGE_KEY]: uint8ToBase64(seed),
				});
			}
		} catch {
			// Ignore storage write errors in non-extension environments
		}
	}

	cachedKey = await globalThis.crypto.subtle.importKey(
		'raw',
		seed as unknown as BufferSource,
		{ name: 'AES-GCM' },
		false,
		['encrypt', 'decrypt'],
	);

	return cachedKey;
}

/**
 * Resets the in-memory cached key (primarily for testing).
 */
export function resetCachedKey(): void {
	cachedKey = null;
}

/**
 * Encrypts a plaintext secret string using Web Crypto AES-GCM-256.
 * Returns an envelope string: `enc:v1:<iv-base64>:<ciphertext-base64>`
 */
export async function encryptSecret(plaintext: string): Promise<string> {
	if (!plaintext || plaintext.startsWith(ENCRYPTION_PREFIX)) {
		return plaintext;
	}

	try {
		const key = await getOrCreateVaultKey();
		const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
		const encoded = new TextEncoder().encode(plaintext);

		const encrypted = await globalThis.crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv },
			key,
			encoded,
		);

		const ivB64 = uint8ToBase64(iv);
		const cipherB64 = uint8ToBase64(new Uint8Array(encrypted));

		return `${ENCRYPTION_PREFIX}${ivB64}:${cipherB64}`;
	} catch {
		// Fallback to original string if Web Crypto fails
		return plaintext;
	}
}

/**
 * Decrypts an envelope string formatted as `enc:v1:<iv-base64>:<ciphertext-base64>`.
 * Transparently returns unencrypted plaintext as-is for backward compatibility.
 */
export async function decryptSecret(ciphertextOrPlain: string): Promise<string> {
	if (!ciphertextOrPlain || !ciphertextOrPlain.startsWith(ENCRYPTION_PREFIX)) {
		return ciphertextOrPlain;
	}

	try {
		const parts = ciphertextOrPlain.split(':');
		if (parts.length !== 4) return ciphertextOrPlain;

		const iv = base64ToUint8(parts[2]);
		const cipherBytes = base64ToUint8(parts[3]);
		const key = await getOrCreateVaultKey();

		const decrypted = await globalThis.crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: iv as unknown as BufferSource },
			key,
			cipherBytes as unknown as BufferSource,
		);

		return new TextDecoder().decode(decrypted);
	} catch {
		// Decryption failed (tampered ciphertext or corrupted key)
		return ciphertextOrPlain;
	}
}

/**
 * Encrypts all API keys in a ProviderApiKeys map before writing to storage.
 */
export async function encryptApiKeys(keys: ProviderApiKeys): Promise<ProviderApiKeys> {
	const encrypted: ProviderApiKeys = {};
	for (const [provider, key] of Object.entries(keys)) {
		if (key && typeof key === 'string') {
			encrypted[provider as LlmProvider] = await encryptSecret(key);
		}
	}
	return encrypted;
}

/**
 * Decrypts all API keys in a ProviderApiKeys map after loading from storage.
 */
export async function decryptApiKeys(keys: ProviderApiKeys): Promise<ProviderApiKeys> {
	const decrypted: ProviderApiKeys = {};
	for (const [provider, key] of Object.entries(keys)) {
		if (key && typeof key === 'string') {
			decrypted[provider as LlmProvider] = await decryptSecret(key);
		}
	}
	return decrypted;
}

/**
 * Estimates token count based on the standard ~4 chars per token rule of thumb.
 */
export function estimateTokens(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / 4);
}
