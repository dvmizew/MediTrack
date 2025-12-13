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
	import { fly, scale } from 'svelte/transition';
	import { quintOut, cubicOut } from 'svelte/easing';
	import { sanitizeHTML } from '$lib/utils/sanitize';

	let { toasts = $bindable([]) }: { toasts: Toast[] } = $props();
	let progressIntervals = new Map<number, NodeJS.Timeout>();
	
	// Production-grade toast management
	const MAX_VISIBLE_TOASTS = 5;
	const TOAST_PRIORITY: Record<Toast['type'], number> = {
		error: 3,
		warning: 2,
		success: 1,
		info: 0
	};
	
	// Only show top MAX_VISIBLE_TOASTS by priority and recency
	let visibleToasts = $derived.by(() => {
		return toasts
			.sort((a, b) => {
				// Higher priority first, then by recency
				const priorityDiff = (TOAST_PRIORITY[b.type] ?? 0) - (TOAST_PRIORITY[a.type] ?? 0);
				if (priorityDiff !== 0) return priorityDiff;
				return (b.id ?? 0) - (a.id ?? 0);
			})
			.slice(0, MAX_VISIBLE_TOASTS);
	});

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
		if (typeof Audio === 'undefined') return;
		
		try {
			const audio = new Audio();
			// Adjust volume based on type
			const volumes: Record<Toast['type'], number> = {
				success: 0.2,
				error: 0.3,
				warning: 0.25,
				info: 0.15
			};
			
			audio.volume = volumes[type] || 0.2;
			
			switch (type) {
				case 'success':
					audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c';
					break;
				case 'error':
					audio.src = 'data:audio/wav;base64,UklGRjYGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAP+BAf7/gf+B/4H/gf+B/4H/gf+B//8=';
					break;
				case 'warning':
					audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c';
					break;
				case 'info':
					audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBWuu/c';
					break;
			}
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
				return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700/50 text-green-900 dark:text-green-100';
			case 'error':
				return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700/50 text-red-900 dark:text-red-100';
			case 'warning':
				return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700/50 text-yellow-900 dark:text-yellow-100';
			case 'info':
				return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700/50 text-blue-900 dark:text-blue-100';
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
			case 'info':
				return 'bg-blue-500';
		}
	}
</script>

<div class="fixed top-4 sm:top-6 right-4 sm:right-6 z-[9999] flex flex-col gap-2 sm:gap-3 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-sm safe-area-top">
	{#each visibleToasts as toast, index (toast.id)}
		<div
			in:fly={{ x: 300, duration: 400, delay: index * 50, easing: quintOut }}
			out:scale={{ duration: 200, easing: cubicOut, opacity: 0, start: 0.9 }}
			class="pointer-events-auto w-full"
		>
			<div class={`rounded-xl shadow-lg sm:shadow-xl border p-3 sm:p-4 ${getColors(toast.type)} backdrop-blur-sm relative overflow-hidden transition-all duration-300`}>
				<!-- Progress bar -->
				{#if toast.duration && toast.duration > 0}
					<div class="absolute bottom-0 left-0 h-1 bg-black/10 dark:bg-white/10 w-full">
						<div 
							class={`h-full transition-all duration-50 ${getProgressColor(toast.type)}`}
							style="width: {100 - (toast.progress || 0)}%"
						></div>
					</div>
				{/if}
				
				<div class="flex gap-2 sm:gap-3 items-start">
					<div class="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center mt-0.5">
						<svg class="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							{@html getIcon(toast.type)}
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<p class="font-semibold text-sm sm:text-base leading-tight">{toast.title}</p>
						<!-- Sanitize HTML content to prevent XSS -->
						<p class="text-xs sm:text-sm mt-1 opacity-90 line-clamp-2 break-words">{@html sanitizeHTML(toast.message)}</p>
					</div>
					<button
						onclick={() => removeToast(toast.id)}
						class="flex-shrink-0 min-w-8 h-8 sm:min-w-10 sm:h-10 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-200 touch-manipulation p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 active:scale-95"
						aria-label="Închide notificarea"
					>
						<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	{/each}
</div>
