import { toast } from './toast';

export type ToastConfig = {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: any) => void;
};

/**
 * Eliminates try-catch boilerplate pattern used 20+ times across Svelte components
 * 
 * BEFORE (repeated ~20 times):
 *   try { await operation(); toast.success(msg) } catch(e) { toast.error(e.message) }
 * 
 * AFTER:
 *   await toastHandler(() => operation(), { successMessage: msg })
 * 
 * This utility automatically handles:
 * - Success toast display
 * - Error extraction and toast display  
 * - Custom callbacks for success/error
 * - Type-safe result handling
 */
export async function toastHandler<T>(
  operation: () => Promise<T>,
  config: ToastConfig = {}
): Promise<T | undefined> {
  const {
    successMessage = 'Operation successful',
    errorMessage = 'Operation failed',
    onSuccess,
    onError,
  } = config;

  try {
    const result = await operation();
    toast.success(successMessage);
    onSuccess?.(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    toast.error(message || errorMessage);
    onError?.(error);
    return undefined;
  }
}
