/**
 * Toast notification wrapper for async operations
 * Automatically handles success/error toasting
 */

import { toast } from './toast.js';

/**
 * Execute async operation with automatic toast notifications
 * @param operation - Async function to execute
 * @param successMessage - Message to show on success (optional)
 * @param errorPrefix - Prefix for error message (default: "Error: ")
 * @returns Promise that resolves to operation result or undefined on error
 */
export async function executeWithToast<T>(
	operation: () => Promise<T>,
	successMessage?: string,
	errorPrefix: string = 'Error: '
): Promise<T | undefined> {
	try {
		const result = await operation();
		if (successMessage) {
			toast.success(successMessage);
		}
		return result;
	} catch (error: any) {
		const errorMsg = error?.message || 'Operation failed';
		toast.error(`${errorPrefix}${errorMsg}`);
		return undefined;
	}
}

/**
 * Execute async operation with only error handling (silent success)
 * @param operation - Async function to execute
 * @param errorPrefix - Prefix for error message (default: "Error: ")
 * @returns Promise that resolves to operation result or undefined on error
 */
export async function executeWithErrorToast<T>(
	operation: () => Promise<T>,
	errorPrefix: string = 'Error: '
): Promise<T | undefined> {
	try {
		return await operation();
	} catch (error: any) {
		const errorMsg = error?.message || 'Operation failed';
		toast.error(`${errorPrefix}${errorMsg}`);
		return undefined;
	}
}

/**
 * Execute async operation with custom success/error handlers
 * @param operation - Async function to execute
 * @param onSuccess - Callback when operation succeeds (receives result)
 * @param onError - Callback when operation fails (receives error)
 * @returns Promise that resolves to operation result or undefined on error
 */
export async function executeWithCallbacks<T>(
	operation: () => Promise<T>,
	onSuccess?: (result: T) => void,
	onError?: (error: Error) => void
): Promise<T | undefined> {
	try {
		const result = await operation();
		if (onSuccess) {
			onSuccess(result);
		}
		return result;
	} catch (error: any) {
		if (onError) {
			onError(error instanceof Error ? error : new Error(String(error)));
		}
		return undefined;
	}
}
