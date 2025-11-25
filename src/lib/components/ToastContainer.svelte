<script context="module" lang="ts">
	export interface Toast {
		id: number;
		type: 'success' | 'error' | 'warning' | 'info';
		title: string;
		message: string;
		duration?: number;
	}
</script>

<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	let { toasts = $bindable([]) }: { toasts: Toast[] } = $props();

	function removeToast(id: number) {
		toasts = toasts.filter((t) => t.id !== id);
	}

	function getIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`;
			case 'error':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`;
			case 'warning':
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>`;
			default:
				return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
		}
	}

	function getColors(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-50 border-green-200 text-green-800';
			case 'error':
				return 'bg-red-50 border-red-200 text-red-800';
			case 'warning':
				return 'bg-yellow-50 border-yellow-200 text-yellow-800';
			default:
				return 'bg-blue-50 border-blue-200 text-blue-800';
		}
	}
</script>

<div class="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
	{#each toasts as toast (toast.id)}
		<div
			transition:fly={{ x: 300, duration: 300, easing: quintOut }}
			class="pointer-events-auto w-full sm:w-96"
		>
			<div class={`rounded-xl shadow-lg border p-3 md:p-4 ${getColors(toast.type)}`}>
				<div class="flex gap-2 md:gap-3">
					<div class="flex-shrink-0">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{@html getIcon(toast.type)}
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-sm md:text-base">{toast.title}</p>
						<p class="text-xs md:text-sm mt-1 opacity-90 line-clamp-2">{toast.message}</p>
					</div>
					<button
						onclick={() => removeToast(toast.id)}
						class="flex-shrink-0 opacity-70 hover:opacity-100 transition touch-manipulation p-1"
						aria-label="Închide notificarea"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>
