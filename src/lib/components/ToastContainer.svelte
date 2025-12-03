<script module lang="ts">
	export interface Toast {
		id: number;
		type: 'success' | 'error' | 'warning' | 'info';
		title: string;
		message: string;
		duration?: number;
		progress?: number;
	}
</script>

<script lang="ts">
	import { fade, fly, scale } from 'svelte/transition';
	import { quintOut, cubicOut } from 'svelte/easing';
	import { onMount } from 'svelte';

	let { toasts = $bindable([]) }: { toasts: Toast[] } = $props();
	let progressIntervals = new Map<number, NodeJS.Timeout>();

	function removeToast(id: number) {
		if (progressIntervals.has(id)) {
			clearInterval(progressIntervals.get(id));
			progressIntervals.delete(id);
		}
		toasts = toasts.filter((t) => t.id !== id);
	}

	function startProgress(toast: Toast) {
		if (!toast.duration || toast.duration <= 0) return;
		
		const startTime = Date.now();
		const interval = setInterval(() => {
			const elapsed = Date.now() - startTime;
			const progress = Math.min((elapsed / toast.duration!) * 100, 100);
			
			toasts = toasts.map(t => 
				t.id === toast.id ? { ...t, progress } : t
			);
			
			if (progress >= 100) {
				clearInterval(interval);
				progressIntervals.delete(toast.id);
			}
		}, 50);
		
		progressIntervals.set(toast.id, interval);
	}

	$effect(() => {
		toasts.forEach(toast => {
			if (!progressIntervals.has(toast.id) && toast.duration) {
				startProgress(toast);
			}
		});
	});

	function playSound(type: Toast['type']) {
		try {
			const audio = new Audio();
			switch(type) {
				case 'success':
					audio.src = 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQA=';
					break;
				case 'error':
					audio.src = 'data:audio/wav;base64,UklGRhwAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQA=';
					break;
			}
			audio.volume = 0.3;
			audio.play().catch(() => {});
		} catch {}
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
				return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300';
			case 'error':
				return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300';
			case 'warning':
				return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300';
			default:
				return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300';
		}
	}

	function getProgressColor(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-500';
			case 'error':
				return 'bg-red-500';
			case 'warning':
				return 'bg-yellow-500';
			default:
				return 'bg-blue-500';
		}
	}
</script>

<div class="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-[calc(100vw-2rem)]">
	{#each toasts as toast, index (toast.id)}
		<div
			in:fly={{ x: 300, duration: 400, delay: index * 50, easing: quintOut }}
			out:scale={{ duration: 200, easing: cubicOut, opacity: 0, start: 0.9 }}
			class="pointer-events-auto w-full sm:w-96"
		>
			<div class={`rounded-xl shadow-xl border p-3 md:p-4 ${getColors(toast.type)} backdrop-blur-sm relative overflow-hidden`}>
				<!-- Progress bar -->
				{#if toast.duration && toast.duration > 0}
					<div class="absolute bottom-0 left-0 h-1 bg-black/10 dark:bg-white/10 w-full">
						<div 
							class={`h-full transition-all duration-50 ${getProgressColor(toast.type)}`}
							style="width: {100 - (toast.progress || 0)}%"
						></div>
					</div>
				{/if}
				
				<div class="flex gap-2 md:gap-3">
					<div class="flex-shrink-0">
						<div class="w-5 h-5 flex items-center justify-center">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								{@html getIcon(toast.type)}
							</svg>
						</div>
					</div>
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-sm md:text-base">{toast.title}</p>
						<p class="text-xs md:text-sm mt-1 opacity-90 line-clamp-2">{toast.message}</p>
					</div>
					<button
						onclick={() => removeToast(toast.id)}
						class="flex-shrink-0 opacity-70 hover:opacity-100 hover:scale-110 transition-all duration-200 touch-manipulation p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
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
