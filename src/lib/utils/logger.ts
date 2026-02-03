/**
 * Centralized logger utility for consistent error/warning logging
 * Consolidates 25+ console.error calls across codebase
 */

type LogLevel = 'error' | 'warn' | 'info';

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === 'string') {
		return error;
	}
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export const logger = {
	error: (context: string, error?: unknown, data?: any) => {
		const isDev = typeof window !== 'undefined' && import.meta.env.DEV;
		const message = error ? formatError(error) : 'Unknown error';
		
		if (isDev) {
			console.error(`[${context}]`, message, data);
		} else {
			// In production, could send to monitoring service
			console.error(`[${context}]`, message);
		}
	},

	warn: (context: string, message: string, data?: any) => {
		const isDev = typeof window !== 'undefined' && import.meta.env.DEV;
		
		if (isDev) {
			console.warn(`[${context}]`, message, data);
		}
	},

	info: (context: string, message: string, data?: any) => {
		const isDev = typeof window !== 'undefined' && import.meta.env.DEV;
		
		if (isDev) {
			console.info(`[${context}]`, message, data);
		}
	}
};

/**
 * Extract error message for user display
 */
export function getUserErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return 'An error occurred. Please try again.';
}
