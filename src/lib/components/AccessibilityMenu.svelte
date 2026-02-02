<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import { accessibility } from '$lib/stores/accessibility';
	import { Accessibility, RotateCcw, Zap } from '@lucide/svelte';

	let isOpen = $state(false);

	const textSizeOptions = [
		{ value: 'normal', label: 'Normal (100%)', icon: 'A' },
		{ value: 'large', label: 'Mare (125%)', icon: 'A+' },
		{ value: 'xlarge', label: 'Extra Mare (150%)', icon: 'A++' }
	];

	onMount(() => {
		// Apply accessibility settings on component mount and subscribe to changes
		const unsubscribe = accessibility.subscribe(settings => {
			if (typeof window !== 'undefined') {
				const root = document.documentElement;
				
				// Text size with CSS variable for cascading
				const sizeMultipliers = {
					normal: 1,
					large: 1.25,
					xlarge: 1.5
				};
				const fontSize = 16 * sizeMultipliers[settings.textSize];
				root.style.fontSize = `${fontSize}px`;
				root.style.setProperty('--font-size-multiplier', String(sizeMultipliers[settings.textSize]));
				
				// High contrast - remove all other contrast classes first
				root.classList.remove('high-contrast');
				if (settings.highContrast) {
					// Force repaint
					void root.offsetHeight;
					root.classList.add('high-contrast');
				}
				
				// Reduce motion - remove first
				root.classList.remove('reduce-motion');
				if (settings.reduceMotion) {
					// Force repaint
					void root.offsetHeight;
					root.classList.add('reduce-motion');
				}
				
				// Store in data attribute for CSS selectors
				root.setAttribute('data-accessibility-text-size', settings.textSize);
				root.setAttribute('data-accessibility-high-contrast', String(settings.highContrast));
				root.setAttribute('data-accessibility-reduce-motion', String(settings.reduceMotion));
			}
		});
		
		return () => unsubscribe();
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.accessibility-dropdown-container')) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative accessibility-dropdown-container">
	<!-- Accessibility Toggle Button -->
	<button
		onclick={() => (isOpen = !isOpen)}
		class="p-2.5 rounded-lg bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition border border-slate-300 dark:border-slate-600 text-gray-700 dark:text-slate-300"
		title="Setări de accesibilitate"
		aria-label="Deschide meniu de accesibilitate"
	>
		<Zap class="w-5 h-5" />
	</button>

	<!-- Dropdown Menu -->
	{#if isOpen}
		<div 
			transition:fly={{ y: -10, duration: 300, easing: quintOut }}
			class="absolute right-0 mt-2 w-72 bg-white/98 dark:bg-slate-800/98 backdrop-blur-md border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden"
		>
			<!-- Header -->
			<div class="px-4 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
				<Accessibility class="w-4 h-4 text-gray-700 dark:text-slate-300" />
				<h3 class="text-sm font-semibold text-gray-900 dark:text-slate-100">Setări Accesibilitate</h3>
			</div>

			<!-- Content -->
			<div class="px-4 py-4 space-y-4">
				<!-- Text Size Controls -->
				<div>
					<p class="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Dimensiune Text</p>
					<div class="space-y-2">
						{#each textSizeOptions as option}
							<button
								onclick={() => {
									accessibility.setTextSize(option.value as any);
									isOpen = false;
								}}
								class="w-full text-left px-3 py-2.5 rounded-lg border-2 transition {$accessibility.textSize === option.value
									? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
									: 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'}"
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
					<label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition">
						<input
							type="checkbox"
							checked={$accessibility.highContrast}
							onchange={(e) => accessibility.setHighContrast(e.currentTarget.checked)}
							class="w-5 h-5 rounded border-gray-300 accent-blue-600"
							aria-label="Contrast crescut"
						/>
						<span class="text-sm font-medium text-gray-700 dark:text-slate-300">Contrast Crescut</span>
					</label>
					<p class="text-xs text-gray-500 dark:text-slate-400 px-2 mt-1">Îmbunătățește vizibilitatea textului și a elementelor</p>
				</div>

				<!-- Reduce Motion Toggle -->
				<div>
					<label class="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition">
						<input
							type="checkbox"
							checked={$accessibility.reduceMotion}
							onchange={(e) => accessibility.setReduceMotion(e.currentTarget.checked)}
							class="w-5 h-5 rounded border-gray-300 accent-blue-600"
							aria-label="Reducere mișcare"
						/>
						<span class="text-sm font-medium text-gray-700 dark:text-slate-300">Reducere Mișcare</span>
					</label>
					<p class="text-xs text-gray-500 dark:text-slate-400 px-2 mt-1">Dezactivează animații și tranzițiile</p>
				</div>

				<!-- Reset Button -->
				<button
					onclick={() => {
						accessibility.reset();
						isOpen = false;
					}}
					class="w-full px-3 py-2.5 mt-2 text-sm font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition border border-gray-200 dark:border-slate-700 flex items-center justify-center gap-2 active:scale-95"
				>
					<RotateCcw class="w-4 h-4" />
					Resetează la Setări Implicite
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* High Contrast Mode - Adapts to light and dark theme */
	
	/* Light Theme High Contrast */
	:global(.high-contrast:not(.dark)) {
		background-color: #ffffff !important;
		color: #000000 !important;
	}

	:global(.high-contrast:not(.dark) body),
	:global(.high-contrast:not(.dark) main),
	:global(.high-contrast:not(.dark) section),
	:global(.high-contrast:not(.dark) article) {
		background-color: #ffffff !important;
		color: #000000 !important;
	}

	:global(.high-contrast:not(.dark) p),
	:global(.high-contrast:not(.dark) span),
	:global(.high-contrast:not(.dark) div),
	:global(.high-contrast:not(.dark) li),
	:global(.high-contrast:not(.dark) h1),
	:global(.high-contrast:not(.dark) h2),
	:global(.high-contrast:not(.dark) h3),
	:global(.high-contrast:not(.dark) h4),
	:global(.high-contrast:not(.dark) h5),
	:global(.high-contrast:not(.dark) h6),
	:global(.high-contrast:not(.dark) label) {
		color: #000000 !important;
		background-color: transparent !important;
		font-weight: 500;
	}

	:global(.high-contrast:not(.dark) button),
	:global(.high-contrast:not(.dark) input[type="button"]),
	:global(.high-contrast:not(.dark) input[type="submit"]) {
		border: 3px solid #000000 !important;
		background-color: #ffffff !important;
		color: #000000 !important;
		font-weight: bold;
		padding: 10px 16px !important;
		border-radius: 6px !important;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
		cursor: pointer;
	}

	:global(.high-contrast:not(.dark) button:hover) {
		background-color: #f0f0f0 !important;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
		transform: translateY(-1px) !important;
	}

	:global(.high-contrast:not(.dark) button:active) {
		background-color: #e0e0e0 !important;
		transform: translateY(0) !important;
	}

	:global(.high-contrast:not(.dark) a) {
		color: #0000cc !important;
		text-decoration: underline !important;
		font-weight: bold;
		text-decoration-thickness: 2px !important;
		text-underline-offset: 3px !important;
	}

	:global(.high-contrast:not(.dark) a:hover) {
		background-color: #ffff00 !important;
		padding: 2px 4px !important;
	}

	:global(.high-contrast:not(.dark) input[type="text"]),
	:global(.high-contrast:not(.dark) input[type="email"]),
	:global(.high-contrast:not(.dark) input[type="password"]),
	:global(.high-contrast:not(.dark) textarea),
	:global(.high-contrast:not(.dark) select) {
		border: 2px solid #000000 !important;
		background-color: #ffffff !important;
		color: #000000 !important;
		padding: 8px 12px !important;
		border-radius: 4px !important;
		font-size: 16px !important;
	}

	:global(.high-contrast:not(.dark) input:focus),
	:global(.high-contrast:not(.dark) textarea:focus),
	:global(.high-contrast:not(.dark) select:focus) {
		outline: 3px solid #0000cc !important;
		outline-offset: 2px !important;
		box-shadow: 0 0 0 4px rgba(0, 0, 204, 0.2) !important;
	}

	:global(.high-contrast:not(.dark) input[type="checkbox"]),
	:global(.high-contrast:not(.dark) input[type="radio"]) {
		border: 2px solid #000000 !important;
		width: 24px !important;
		height: 24px !important;
		accent-color: #0000cc !important;
		cursor: pointer;
	}

	/* Dark Theme High Contrast - Inverted (dark bg with bright text) */
	:global(.high-contrast.dark) {
		background-color: #0a0a0a !important;
		color: #ffffff !important;
	}

	:global(.high-contrast.dark body),
	:global(.high-contrast.dark main),
	:global(.high-contrast.dark section),
	:global(.high-contrast.dark article) {
		background-color: #000000 !important;
		color: #ffffff !important;
	}

	:global(.high-contrast.dark p),
	:global(.high-contrast.dark span),
	:global(.high-contrast.dark div),
	:global(.high-contrast.dark li),
	:global(.high-contrast.dark h1),
	:global(.high-contrast.dark h2),
	:global(.high-contrast.dark h3),
	:global(.high-contrast.dark h4),
	:global(.high-contrast.dark h5),
	:global(.high-contrast.dark h6),
	:global(.high-contrast.dark label),
	:global(.high-contrast.dark .text-gray-700),
	:global(.high-contrast.dark .dark\:text-slate-300) {
		color: #ffffff !important;
		background-color: transparent !important;
		font-weight: 500;
	}

	:global(.high-contrast.dark .bg-gray-100),
	:global(.high-contrast.dark .dark\:bg-slate-700),
	:global(.high-contrast.dark .bg-slate-50),
	:global(.high-contrast.dark .dark\:bg-slate-800) {
		background-color: #1a1a1a !important;
		color: #ffffff !important;
	}

	:global(.high-contrast.dark .bg-white),
	:global(.high-contrast.dark .dark\:bg-slate-900) {
		background-color: #0a0a0a !important;
		color: #ffffff !important;
	}

	:global(.high-contrast.dark button),
	:global(.high-contrast.dark input[type="button"]),
	:global(.high-contrast.dark input[type="submit"]) {
		border: 3px solid #ffffff !important;
		background-color: #000000 !important;
		color: #ffffff !important;
		font-weight: bold;
		padding: 10px 16px !important;
		border-radius: 6px !important;
		cursor: pointer;
	}

	:global(.high-contrast.dark button:hover) {
		background-color: #1a1a1a !important;
		border-color: #ffffff !important;
	}

	:global(.high-contrast.dark button:active) {
		background-color: #000000 !important;
	}

	:global(.high-contrast.dark a) {
		color: #ffffff !important;
		text-decoration: underline !important;
		font-weight: bold;
		text-decoration-thickness: 2px !important;
		text-underline-offset: 3px !important;
	}

	:global(.high-contrast.dark a:hover) {
		text-decoration: underline !important;
	}

	:global(.high-contrast.dark input[type="text"]),
	:global(.high-contrast.dark input[type="email"]),
	:global(.high-contrast.dark input[type="password"]),
	:global(.high-contrast.dark textarea),
	:global(.high-contrast.dark select) {
		border: 3px solid #ffffff !important;
		background-color: #000000 !important;
		color: #ffffff !important;
		padding: 8px 12px !important;
		border-radius: 4px !important;
		font-size: 16px !important;
	}

	:global(.high-contrast.dark input:focus),
	:global(.high-contrast.dark textarea:focus),
	:global(.high-contrast.dark select:focus) {
		outline: 3px solid #ffffff !important;
		outline-offset: 2px !important;
		border-color: #ffffff !important;
	}

	:global(.high-contrast.dark input[type="checkbox"]),
	:global(.high-contrast.dark input[type="radio"]) {
		border: 2px solid #ffffff !important;
		width: 24px !important;
		height: 24px !important;
		accent-color: #ffffff !important;
		cursor: pointer;
	}

	:global(.high-contrast.dark [class*="border"]) {
		border-color: #ffffff !important;
	}

	/* High Contrast - Make dropdowns and navbar opaque */
	:global(.high-contrast header) {
		background-color: #ffffff !important;
		background-image: none !important;
		backdrop-filter: none !important;
	}

	:global(.high-contrast.dark header) {
		background-color: #000000 !important;
		background-image: none !important;
		backdrop-filter: none !important;
	}

	/* Light theme - make all transparent backgrounds opaque */
	:global(.high-contrast [class*="bg-white/"]),
	:global(.high-contrast [class*="backdrop-blur"]),
	:global(.high-contrast [class*="bg-gray/"]),
	:global(.high-contrast [class*="bg-slate-50"]) {
		background-color: #ffffff !important;
		background-image: none !important;
		backdrop-filter: none !important;
	}

	/* Dark theme - make all transparent backgrounds opaque */
	:global(.high-contrast.dark [class*="bg-slate-"]),
	:global(.high-contrast.dark [class*="bg-gray/"]),
	:global(.high-contrast.dark [class*="backdrop-blur"]),
	:global(.high-contrast.dark [class*="bg-white/"]) {
		background-color: #000000 !important;
		background-image: none !important;
		backdrop-filter: none !important;
	}

	/* Ensure all elements with opacity transparency become solid */
	:global(.high-contrast [class*="bg-"] [class*="/"] ) {
		background-color: #ffffff !important;
		backdrop-filter: none !important;
	}

	:global(.high-contrast.dark [class*="bg-"] [class*="/"] ) {
		background-color: #000000 !important;
		backdrop-filter: none !important;
	}

	/* Fix text colors in high contrast for dark theme */
	:global(.high-contrast.dark .text-slate-300),
	:global(.high-contrast.dark .text-slate-400),
	:global(.high-contrast.dark .text-gray-500),
	:global(.high-contrast.dark .text-gray-600),
	:global(.high-contrast.dark .text-gray-700) {
		color: #ffffff !important;
	}

	/* Fix background colors that lose visibility */
	:global(.high-contrast .bg-gray-100),
	:global(.high-contrast .bg-gray-50) {
		background-color: #ffffff !important;
	}

	:global(.high-contrast.dark .bg-gray-100),
	:global(.high-contrast.dark .bg-gray-50),
	:global(.high-contrast.dark .bg-slate-700),
	:global(.high-contrast.dark .bg-slate-600) {
		background-color: #000000 !important;
	}

	/* Fix border colors in high contrast */
	:global(.high-contrast .border-gray-100),
	:global(.high-contrast .border-gray-200),
	:global(.high-contrast .border-slate-300),
	:global(.high-contrast .border-slate-200) {
		border-color: #000000 !important;
	}

	:global(.high-contrast.dark .border-gray-100),
	:global(.high-contrast.dark .border-gray-200),
	:global(.high-contrast.dark .border-slate-300),
	:global(.high-contrast.dark .border-slate-600),
	:global(.high-contrast.dark .border-slate-700) {
		border-color: #ffffff !important;
	}

	/* Fix checkbox borders */
	:global(.high-contrast .border-gray-300) {
		border-color: #000000 !important;
	}

	:global(.high-contrast.dark .border-gray-300) {
		border-color: #ffffff !important;
	}

	/* Fix gradients and light backgrounds in high contrast */
	:global(.high-contrast [class*="from-"]),
	:global(.high-contrast [class*="to-"]),
	:global(.high-contrast [class*="via-"]),
	:global(.high-contrast .bg-gradient-to-br),
	:global(.high-contrast .bg-gradient-to-r) {
		background: #ffffff !important;
	}

	:global(.high-contrast.dark [class*="from-"]),
	:global(.high-contrast.dark [class*="to-"]),
	:global(.high-contrast.dark [class*="via-"]),
	:global(.high-contrast.dark .bg-gradient-to-br),
	:global(.high-contrast.dark .bg-gradient-to-r) {
		background: #000000 !important;
	}

	/* Specific gradient fixes */
	:global(.high-contrast .from-blue-50),
	:global(.high-contrast .to-purple-50),
	:global(.high-contrast .to-white),
	:global(.high-contrast .from-blue-100),
	:global(.high-contrast .to-purple-100) {
		background-color: #ffffff !important;
	}

	:global(.high-contrast.dark .from-gray-800),
	:global(.high-contrast.dark .to-gray-900),
	:global(.high-contrast.dark .from-gray-900),
	:global(.high-contrast.dark .via-gray-800) {
		background-color: #000000 !important;
	}

	/* Fix hover backgrounds in high contrast */
	:global(.high-contrast .hover\:bg-gray-50),
	:global(.high-contrast .hover\:bg-gray-100),
	:global(.high-contrast .hover\:bg-gray-200) {
		background-color: #ffffff !important;
	}

	:global(.high-contrast.dark .hover\:bg-gray-50),
	:global(.high-contrast.dark .hover\:bg-gray-100),
	:global(.high-contrast.dark .hover\:bg-gray-200),
	:global(.high-contrast.dark .hover\:bg-slate-600),
	:global(.high-contrast.dark .hover\:bg-slate-700),
	:global(.high-contrast.dark .hover\:bg-slate-800) {
		background-color: #000000 !important;
	}

	/* Fix bg-gray elements */
	:global(.high-contrast .bg-gray-200),
	:global(.high-contrast .bg-gray-50) {
		background-color: #ffffff !important;
	}

	:global(.high-contrast.dark .bg-gray-200),
	:global(.high-contrast.dark .bg-gray-50),
	:global(.high-contrast.dark .bg-gray-700) {
		background-color: #000000 !important;
	}

	/* Fix blue/active backgrounds */
	:global(.high-contrast .bg-blue-50),
	:global(.high-contrast .bg-blue-100) {
		background-color: #ffffff !important;
	}

	:global(.high-contrast.dark .bg-blue-50) {
		background-color: #000000 !important;
	}

	/* Fix red backgrounds */
	:global(.high-contrast .hover\:bg-red-50) {
		background-color: transparent !important;
	}

	/* Reduce Motion Mode - Disable all animations */
	:global(.reduce-motion *) {
		animation-duration: 0.01ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: 0.01ms !important;
	}

	:global(.reduce-motion .animate-spin),
	:global(.reduce-motion .animate-pulse),
	:global(.reduce-motion .animate-bounce),
	:global(.reduce-motion .animate-fade-in),
	:global(.reduce-motion [class*="animate-"]) {
		animation: none !important;
	}

	:global(.reduce-motion [transition]) {
		transition: none !important;
	}

	:global(.reduce-motion svg) {
		animation: none !important;
	}
</style>
