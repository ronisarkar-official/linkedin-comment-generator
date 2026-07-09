/**
 * Lightweight structured logger for the LinkedIn Comment Generator extension.
 *
 * All log lines are prefixed with `[LCG]` and a level tag so they can be
 * filtered easily in DevTools.  The logger is intentionally kept as a thin
 * wrapper around `console` — no external dependencies, no async I/O.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const PREFIX = '[LCG]';

/** Minimum level that will actually be emitted.  Production builds default
 *  to 'warn' to keep the console clean; development defaults to 'debug'. */
const IS_PROD: boolean = (() => {
	try {
		// Vite replaces import.meta.env.PROD at build time
		return !!(import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD;
	} catch {
		return true;
	}
})();
let minLevel: LogLevel = IS_PROD ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
	return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

function timestamp(): string {
	return new Date().toISOString();
}

function formatContext(context?: Record<string, unknown>): string {
	if (!context || Object.keys(context).length === 0) return '';
	try {
		return ' ' + JSON.stringify(context);
	} catch {
		return ' [unserializable context]';
	}
}

export const logger = {
	/** Set the minimum log level.  Messages below this level are silently dropped. */
	setLevel(level: LogLevel): void {
		minLevel = level;
	},

	debug(message: string, context?: Record<string, unknown>): void {
		if (!shouldLog('debug')) return;
		console.debug(`${PREFIX} ${timestamp()} [DEBUG] ${message}${formatContext(context)}`);
	},

	info(message: string, context?: Record<string, unknown>): void {
		if (!shouldLog('info')) return;
		console.info(`${PREFIX} ${timestamp()} [INFO] ${message}${formatContext(context)}`);
	},

	warn(message: string, context?: Record<string, unknown>): void {
		if (!shouldLog('warn')) return;
		console.warn(`${PREFIX} ${timestamp()} [WARN] ${message}${formatContext(context)}`);
	},

	error(message: string, context?: Record<string, unknown>): void {
		if (!shouldLog('error')) return;
		console.error(`${PREFIX} ${timestamp()} [ERROR] ${message}${formatContext(context)}`);
	},
} as const;
