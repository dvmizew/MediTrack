<script lang="ts">
	/**
	 * Keyboard Navigation Component
	 * Provides global keyboard shortcuts for accessibility
	 */
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	const shortcuts = [
		{ key: 'g d', description: 'Go to Dashboard', action: () => goto('/dashboard') },
		{ key: 'g t', description: 'Go to Treatments', action: () => goto('/treatments') },
		{ key: 'g c', description: 'Go to Chat', action: () => goto('/chat') },
		{ key: 'g l', description: 'Go to Leaderboard', action: () => goto('/leaderboard') },
		{ key: '/', description: 'Focus search', action: () => focusSearch() },
		{ key: '?', description: 'Show keyboard shortcuts', action: () => toggleHelp() }
	];

	let lastKey = '';
	let lastKeyTime = 0;
	let showHelp = $state(false);

	// Normalize shortcut keys so "g d" matches the typed combo "gd"
	const normalizeKey = (value: string) => value.replace(/\s+/g, '');

	function handleKeyDown(e: KeyboardEvent) {
		// Don't intercept when typing in inputs
		if (
			e.target instanceof HTMLInputElement ||
			e.target instanceof HTMLTextAreaElement ||
			e.target instanceof HTMLSelectElement
		) {
			return;
		}

		const key = e.key.toLowerCase();
		const now = Date.now();

		// Escape key to close modals
		if (key === 'escape') {
			showHelp = false;
			// Dispatch custom event for other components
			window.dispatchEvent(new CustomEvent('escape-pressed'));
			return;
		}

		// Check for combo shortcuts (e.g., "g d")
		if (now - lastKeyTime < 1000) {
			const combo = normalizeKey(lastKey + key);
			const shortcut = shortcuts.find((s) => normalizeKey(s.key) === combo);
			if (shortcut) {
				e.preventDefault();
				shortcut.action();
				lastKey = '';
				return;
			}
		}

		// Single key shortcuts
		if (key === '?') {
			e.preventDefault();
			toggleHelp();
			lastKey = '';
			return;
		}

		if (key === '/') {
			e.preventDefault();
			focusSearch();
			lastKey = '';
			return;
		}

		// Store key for combo detection
		lastKey = key;
		lastKeyTime = now;
	}

	function focusSearch() {
		const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
		if (searchInput) {
			searchInput.focus();
		}
	}

	function toggleHelp() {
		showHelp = !showHelp;
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('keydown', handleKeyDown);
		}
	});
</script>

<!-- Keyboard Shortcuts Help Modal -->
{#if showHelp}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onclick={() => (showHelp = false)}
		onkeydown={(e) => e.key === 'Escape' && (showHelp = false)}
		role="dialog"
		aria-labelledby="keyboard-shortcuts-title"
		aria-modal="true"
		tabindex={0}
	>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
			tabindex={0}
		>
			<div class="flex justify-between items-center mb-4">
				<h2 id="keyboard-shortcuts-title" class="text-xl font-bold text-gray-900 dark:text-gray-100">
					Comenzi rapide tastatură
				</h2>
				<button
					onclick={() => (showHelp = false)}
					class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
					aria-label="Închide"
					type="button"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-2">
				{#each shortcuts as shortcut}
					<div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
						<span class="text-sm text-gray-600 dark:text-gray-400">{shortcut.description}</span>
						<kbd class="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono font-semibold">
							{shortcut.key.toUpperCase()}
						</kbd>
					</div>
				{/each}
			</div>

			<div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
				<p class="text-xs text-blue-800 dark:text-blue-200">
					<strong>Sfat:</strong> Apasă <kbd class="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs font-mono">ESC</kbd> pentru a închide modalele.
				</p>
			</div>
		</div>
	</div>
{/if}
