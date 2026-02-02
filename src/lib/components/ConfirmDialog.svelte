<script lang="ts">
	import { scale } from 'svelte/transition';

	interface Props {
		isOpen: boolean;
		title: string;
		message: string;
		onConfirm: () => void;
		onCancel: () => void;
		confirmText?: string;
		cancelText?: string;
		isDangerous?: boolean;
	}

	let {
		isOpen = false,
		title = 'Confirmă',
		message = 'Sigur vrei să continui?',
		onConfirm,
		onCancel,
		confirmText = 'Confirmare',
		cancelText = 'Anulează',
		isDangerous = false
	}: Props = $props();

	function handleBackdropClick() {
		onCancel();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onCancel();
		}
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 z-50 bg-black/60 transition-opacity duration-200"
		onclick={handleBackdropClick}
		onkeydown={handleKeyDown}
		role="presentation"
	>
		<div
			transition:scale={{ duration: 200, start: 0.95 }}
			class="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
		>
			<div
				class="bg-white/98 dark:bg-slate-800/98 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 p-4 sm:p-6 max-w-sm w-11/12 pointer-events-auto"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-title"
				tabindex="-1"
			>
				<!-- Title -->
				<h3 id="confirm-title" class="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
					{title}
				</h3>

				<!-- Message -->
				<p class="text-sm sm:text-base text-gray-600 dark:text-slate-400 mb-6">
					{message}
				</p>

				<!-- Actions -->
				<div class="flex gap-3 justify-end">
					<button
						type="button"
						onclick={onCancel}
						class="px-4 py-2 text-sm sm:text-base font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition active:scale-95"
					>
						{cancelText}
					</button>
					<button
						type="button"
						onclick={onConfirm}
						class="px-4 py-2 text-sm sm:text-base font-medium text-white {isDangerous
							? 'bg-red-600 hover:bg-red-700'
							: 'bg-blue-600 hover:bg-blue-700'} rounded-lg transition active:scale-95"
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
