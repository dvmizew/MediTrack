<script lang="ts">
	import { scale, fade } from 'svelte/transition';

	export interface Props {
		isOpen: boolean;
		title?: string;
		content?: string;
		onClose: () => void;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		type?: 'info' | 'warning' | 'error' | 'success';
		showCancel?: boolean;
		confirmText?: string;
		cancelText?: string;
		onConfirm?: () => void | Promise<void>;
		onCancel?: () => void;
		children?: any;
		isLoading?: boolean;
	}

	let {
		isOpen = false,
		title,
		content,
		onClose,
		closeOnBackdrop = true,
		closeOnEscape = true,
		size = 'md',
		type = 'info',
		showCancel = false,
		confirmText = 'OK',
		cancelText = 'Anulează',
		onConfirm,
		onCancel,
		children,
	}: Props = $props();

	let isProcessing = $state(false);

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-2xl',
		xl: 'max-w-3xl'
	};

	const typeClasses = {
		info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
		warning: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
		error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
		success: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
	};

	const typeIcons = {
		info: '🔵',
		warning: '⚠️',
		error: '❌',
		success: '✓'
	};

	function handleBackdropClick() {
		if (closeOnBackdrop && !isProcessing) {
			onClose();
		}
	}

	function handleWindowKeyDown(e: KeyboardEvent) {
		if (isOpen && closeOnEscape && e.key === 'Escape' && !isProcessing) {
			e.preventDefault();
			onClose();
		}
	}

	async function handleConfirm() {
		if (onConfirm) {
			isProcessing = true;
			try {
				await onConfirm();
			} finally {
				isProcessing = false;
			}
		}
		onClose();
	}

	function handleCancel() {
		if (onCancel) {
			onCancel();
		}
		onClose();
	}
</script>

<svelte:window onkeydown={handleWindowKeyDown} />

{#if isOpen}
	<div
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
		onclick={handleBackdropClick}
		role="presentation"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 {sizeClasses[size]} w-11/12 pointer-events-auto max-h-[90vh] flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			tabindex="-1"
		>
			<!-- Header with type indicator -->
			{#if title || type !== 'info'}
				<div class="flex justify-between items-start mb-4">
					<div class="flex items-start gap-3 flex-1">
						{#if type && type !== 'info'}
							<span class="text-2xl flex-shrink-0 pt-1" aria-hidden="true">
								{typeIcons[type]}
							</span>
						{/if}
						{#if title}
							<h2 id="modal-title" class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
								{title}
							</h2>
						{/if}
					</div>
					<button
						onclick={onClose}
						disabled={isProcessing}
						class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
						aria-label="Închide"
						type="button"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- Content -->
			<div class="mb-6 overflow-y-auto flex-1 pr-2">
				{#if content}
					<p class="text-sm sm:text-base text-gray-600 dark:text-gray-400">
						{content}
					</p>
				{/if}
				{#if children}
					<div>
						{@render children?.()}
					</div>
				{/if}
			</div>

			<!-- Footer with actions -->
			{#if showCancel || onConfirm}
				<div class="flex gap-3 justify-end">
					{#if showCancel}
						<button
							type="button"
							onclick={handleCancel}
							disabled={isProcessing}
							class="px-4 py-2 text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{cancelText}
						</button>
					{/if}
					{#if onConfirm}
							<button
							type="button"
							onclick={handleConfirm}
							disabled={isProcessing}
							class="px-4 py-2 text-sm sm:text-base font-medium text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed
								{(type === 'error' || type === 'warning')
									? 'bg-red-600 hover:bg-red-700'
									: type === 'success'
										? 'bg-green-600 hover:bg-green-700'
										: 'bg-blue-600 hover:bg-blue-700'}"
						>
							{#if isProcessing}
								<span class="inline-block animate-spin mr-2">⏳</span>
							{/if}
							{confirmText}
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}
