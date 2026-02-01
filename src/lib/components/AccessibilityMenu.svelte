<script lang="ts">
	import { accessibility } from '$lib/stores/accessibility';
	import { Accessibility, RotateCcw, Zap } from '@lucide/svelte';

	let isOpen = $state(false);

	const textSizeOptions = [
		{ value: 'normal', label: 'Normal (100%)', icon: 'A' },
		{ value: 'large', label: 'Mare (125%)', icon: 'A+' },
		{ value: 'xlarge', label: 'Extra Mare (150%)', icon: 'A++' }
	];
</script>

<div class="relative">
	<!-- Accessibility Toggle Button -->
	<button
		onclick={() => (isOpen = !isOpen)}
		class="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
		title="Setări de accesibilitate"
		aria-label="Deschide meniu de accesibilitate"
	>
		<Zap class="w-5 h-5" />
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div class="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
			<!-- Header -->
			<div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
				<Accessibility class="w-4 h-4" />
				<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Setări Accesibilitate</h3>
			</div>

			<!-- Content -->
			<div class="px-4 py-4 space-y-4">
				<!-- Text Size Controls -->
				<div>
					<p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Dimensiune Text</p>
					<div class="space-y-2">
						{#each textSizeOptions as option}
							<button
								onclick={() => {
									accessibility.setTextSize(option.value as any);
									isOpen = false;
								}}
								class="w-full text-left px-3 py-2 rounded-lg border-2 transition {$accessibility.textSize === option.value
									? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
									: 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'}"
								aria-label={option.label}
							>
								<span class="font-bold mr-2">{option.icon}</span>
								<span class="text-sm">{option.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- High Contrast Toggle -->
				<div>
					<label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition">
						<input
							type="checkbox"
							checked={$accessibility.highContrast}
							onchange={(e) => accessibility.setHighContrast(e.currentTarget.checked)}
							class="w-5 h-5 rounded border-gray-300 accent-blue-600"
							aria-label="Contrast crescut"
						/>
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Contrast Crescut</span>
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400 px-2 mt-1">Îmbunătățește vizibilitatea textului și a elementelor</p>
				</div>

				<!-- Reduce Motion Toggle -->
				<div>
					<label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition">
						<input
							type="checkbox"
							checked={$accessibility.reduceMotion}
							onchange={(e) => accessibility.setReduceMotion(e.currentTarget.checked)}
							class="w-5 h-5 rounded border-gray-300 accent-blue-600"
							aria-label="Reducere mișcare"
						/>
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Reducere Mișcare</span>
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400 px-2 mt-1">Dezactivează animații și tranzițiile</p>
				</div>

			<!-- Reset Button -->
			<button
				onclick={() => {
					accessibility.reset();
					isOpen = false;
				}}
				class="w-full px-3 py-2 mt-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition border border-gray-300 dark:border-gray-600 flex items-center justify-center gap-2"
			>
				<RotateCcw class="w-4 h-4" />
				Resetează la Setări Implicite
			</button>
			</div>

			<!-- Footer Info -->
			<div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
				<p class="text-xs text-gray-600 dark:text-gray-400">
					Setările tale sunt salvate automat și vor fi reamintite la vizita următoare.
				</p>
			</div>
		</div>
	{/if}
</div>

<!-- Click outside to close -->
<svelte:window
	onclick={(e) => {
		if (isOpen && !(e.target as HTMLElement).closest('[accessibility-menu]')) {
			const button = document.querySelector('[title="Setări de accesibilitate"]');
			if (!button?.contains(e.target as Node)) {
				isOpen = false;
			}
		}
	}}
/>

<style>
	/* Accessibility CSS Classes */
	:global(.high-contrast) {
		--tw-text-opacity: 1;
		color: rgb(0 0 0 / var(--tw-text-opacity));
		background-color: rgb(255 255 255);
	}

	:global(.high-contrast .dark) {
		color: rgb(255 255 255);
		background-color: rgb(0 0 0);
	}

	:global(.high-contrast button) {
		border-width: 2px;
	}

	/* Reduce motion - disable animations */
	:global(.reduce-motion *) {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.01ms !important;
	}

	:global(.reduce-motion .animate-spin),
	:global(.reduce-motion .animate-pulse),
	:global(.reduce-motion .animate-bounce) {
		animation: none !important;
	}
</style>
