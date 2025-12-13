<script lang="ts">
	import { scale } from 'svelte/transition';
	interface Props {
		isOpen: boolean;
		title?: string;
		onClose: () => void;
		closeOnBackdrop?: boolean;
		closeOnEscape?: boolean;
		size?: 'sm' | 'md' | 'lg';
		children?: any;
	}

	let {
		isOpen = false,
		title,
		onClose,
		closeOnBackdrop = true,
		closeOnEscape = true,
		size = 'md',
		children
	}: Props = $props();

	const sizeClasses = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg'
	};

	function handleBackdropClick() {
		if (closeOnBackdrop) {
			onClose();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (closeOnEscape && e.key === 'Escape') {
			onClose();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 {sizeClasses[size]} w-11/12 pointer-events-auto"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? 'modal-title' : undefined}
			tabindex="-1"
		>
			{#if title}
				<div class="flex justify-between items-center mb-4">
					<h2 id="modal-title" class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
						{title}
					</h2>
					<button
						onclick={onClose}
						class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
						aria-label="Închide"
						type="button"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			{/if}

			{@render children?.()}
		</div>
	</div>
{/if}
