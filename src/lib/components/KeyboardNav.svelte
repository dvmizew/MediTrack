<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';

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
<Modal
	isOpen={showHelp}
	title="Comenzi rapide tastatură"
	onClose={() => (showHelp = false)}
	closeOnBackdrop={true}
	closeOnEscape={true}
	size="md"
>
	<div class="space-y-2">
		{#each shortcuts as shortcut}
			<div class="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
				<span class="text-sm text-gray-600 dark:text-slate-400">{shortcut.description}</span>
				<kbd class="px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded text-xs font-mono font-semibold">
					{shortcut.key.toUpperCase()}
				</kbd>
			</div>
		{/each}
	</div>

	<div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
		<p class="text-xs text-blue-800 dark:text-blue-200">
			<strong>Sfat:</strong> Apasă <kbd class="px-1.5 py-0.5 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md rounded text-xs font-mono">ESC</kbd> pentru a închide modalele.
		</p>
	</div>
</Modal>
