<script lang="ts">
	import { onMount } from 'svelte';
	
	let showBanner = $state(false);
	
	onMount(() => {
		const consent = localStorage.getItem('cookieConsent');
		if (!consent) {
			// Delay showing banner slightly for better UX
			setTimeout(() => {
				showBanner = true;
			}, 1000);
		}
	});
	
	function acceptCookies() {
		localStorage.setItem('cookieConsent', 'accepted');
		localStorage.setItem('cookieConsentDate', new Date().toISOString());
		showBanner = false;
	}
	
	function rejectCookies() {
		localStorage.setItem('cookieConsent', 'rejected');
		localStorage.setItem('cookieConsentDate', new Date().toISOString());
		showBanner = false;
		// În producție, ar trebui să dezactivăm cookies ne-esențiale aici
	}
</script>

{#if showBanner}
	<!-- Cookie Consent Banner - GDPR Compliant -->
	<div 
		class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t-4 border-blue-600 dark:border-blue-500 shadow-2xl z-[9999] animate-slide-up"
		role="dialog"
		aria-labelledby="cookie-consent-title"
		aria-describedby="cookie-consent-description"
	>
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<!-- Content -->
				<div class="flex-1 min-w-0">
					<div class="flex items-start gap-3 mb-2">
						<span class="text-3xl flex-shrink-0" aria-hidden="true">🍪</span>
						<div>
							<h2 
								id="cookie-consent-title"
								class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1"
							>
								Folosim cookies
							</h2>
							<p 
								id="cookie-consent-description"
								class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
							>
								MediTrack folosește cookies strict necesare pentru autentificare și salvarea preferințelor tale (tema dark/light). 
								<strong>Datele tale medicale sunt protejate conform GDPR</strong> și nu sunt partajate cu terțe părți.
							</p>
							<p class="text-xs text-gray-600 dark:text-gray-400 mt-2">
								Cookie-urile esențiale: autentificare JWT, preferințe UI. 
								<a href="/privacy" class="underline hover:text-blue-600 dark:hover:text-blue-400">
									Politica de confidențialitate
								</a>
							</p>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
					<button 
						onclick={rejectCookies}
						class="min-h-[48px] px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
						       text-gray-900 dark:text-gray-100 rounded-xl font-semibold transition-all duration-200 
						       focus:outline-none focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
						aria-label="Refuză cookies ne-esențiale"
					>
						Refuză
					</button>
					<button 
						onclick={acceptCookies}
						class="min-h-[48px] px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
						       text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 
						       focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
						aria-label="Acceptă cookies esențiale"
					>
						Accept cookies
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-slide-up {
		animation: slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1);
	}
</style>
